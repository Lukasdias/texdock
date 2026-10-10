"""Compile trigger, artifacts, log, and the live status WebSocket."""

import tempfile
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.latex import synctex
from app.latex.compiler import materialize
from app.latex.logparser import parse_log
from app.models import Compilation, File, Project
from app.schemas import SynctexForward, SynctexInverse

router = APIRouter(prefix="/api/projects/{project_id}", tags=["compile"])
ws_router = APIRouter(tags=["compile"])


async def _require_project(session: AsyncSession, project_id: UUID) -> Project:
    project = await session.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="project not found")
    return project


async def _newest_successful_pdf(
    session: AsyncSession, project_id: UUID
) -> Compilation | None:
    result = await session.execute(
        select(Compilation)
        .where(
            Compilation.project_id == project_id,
            Compilation.status == "success",
            Compilation.pdf.isnot(None),
        )
        .order_by(Compilation.started_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


@router.post("/compile", status_code=202)
async def trigger_compile(
    project_id: UUID,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    await _require_project(session, project_id)
    await request.app.state.compile_queue.enqueue(project_id)
    return {"status": "queued"}


@router.get("/pdf")
async def get_pdf(
    project_id: UUID,
    download: int = 0,
    session: AsyncSession = Depends(get_session),
) -> Response:
    project = await _require_project(session, project_id)
    compilation = await _newest_successful_pdf(session, project_id)
    if compilation is None or compilation.pdf is None:
        raise HTTPException(status_code=404, detail="no compiled PDF yet")
    headers = {}
    if download:
        stem = Path(project.main_file).stem or "document"
        headers["Content-Disposition"] = f'attachment; filename="{stem}.pdf"'
    return Response(
        content=compilation.pdf, media_type="application/pdf", headers=headers
    )


@router.get("/synctex")
async def get_synctex(
    project_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> Response:
    await _require_project(session, project_id)
    result = await session.execute(
        select(Compilation)
        .where(
            Compilation.project_id == project_id,
            Compilation.synctex.isnot(None),
        )
        .order_by(Compilation.started_at.desc())
        .limit(1)
    )
    compilation = result.scalar_one_or_none()
    if compilation is None or compilation.synctex is None:
        raise HTTPException(status_code=404, detail="no synctex data yet")
    return Response(content=compilation.synctex, media_type="application/gzip")


@router.get("/log")
async def get_log(
    project_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict:
    await _require_project(session, project_id)
    result = await session.execute(
        select(Compilation)
        .where(Compilation.project_id == project_id)
        .order_by(Compilation.started_at.desc())
        .limit(1)
    )
    compilation = result.scalar_one_or_none()
    if compilation is None:
        return {"status": None, "log": "", "problems": []}
    log = compilation.log or ""
    return {
        "status": compilation.status,
        "log": log,
        "problems": [p.model_dump() for p in parse_log(log)],
    }


async def _load_files(session: AsyncSession, project_id: UUID) -> list[File]:
    result = await session.execute(
        select(File).where(File.project_id == project_id)
    )
    return list(result.scalars().all())


@router.get("/synctex/forward", response_model=SynctexForward)
async def synctex_forward(
    project_id: UUID,
    file: str,
    line: int,
    session: AsyncSession = Depends(get_session),
) -> SynctexForward:
    project = await _require_project(session, project_id)
    compilation = await _newest_successful_pdf(session, project_id)
    if compilation is None or compilation.pdf is None or compilation.synctex is None:
        raise HTTPException(status_code=404, detail="no synctex data yet")
    files = await _load_files(session, project_id)
    root = Path(settings.compile_root)
    root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=root) as tmp:
        dest = Path(tmp)
        materialize(files, dest)
        pdf_path = dest / f"{Path(project.main_file).stem}.pdf"
        pdf_path.write_bytes(compilation.pdf)
        return synctex.forward(
            file, line, pdf_path, compilation.synctex, dest
        )


@router.get("/synctex/inverse", response_model=SynctexInverse)
async def synctex_inverse(
    project_id: UUID,
    page: int,
    x: float,
    y: float,
    session: AsyncSession = Depends(get_session),
) -> SynctexInverse:
    project = await _require_project(session, project_id)
    compilation = await _newest_successful_pdf(session, project_id)
    if compilation is None or compilation.pdf is None or compilation.synctex is None:
        raise HTTPException(status_code=404, detail="no synctex data yet")
    files = await _load_files(session, project_id)
    root = Path(settings.compile_root)
    root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=root) as tmp:
        dest = Path(tmp)
        materialize(files, dest)
        pdf_path = dest / f"{Path(project.main_file).stem}.pdf"
        pdf_path.write_bytes(compilation.pdf)
        return synctex.inverse(
            page, x, y, pdf_path, compilation.synctex, dest
        )


@ws_router.websocket("/api/ws/{project_id}")
async def compile_socket(websocket: WebSocket, project_id: UUID) -> None:
    manager = websocket.app.state.ws_manager
    await manager.connect(project_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        manager.disconnect(project_id, websocket)
