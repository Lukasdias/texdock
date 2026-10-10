"""Project file tree CRUD: text save/load, binary assets, traversal guard."""

import mimetypes
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Response,
    UploadFile,
)
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.models import File as FileModel
from app.models import Project
from app.paths import InvalidPathError, normalize_project_path
from app.schemas import FileText, TreeNode

router = APIRouter(prefix="/api/projects/{project_id}/files", tags=["files"])


class FileWrite(BaseModel):
    content: str


def _normalize(raw: str) -> str:
    try:
        return normalize_project_path(raw)
    except InvalidPathError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


async def _require_project(session: AsyncSession, project_id: UUID) -> Project:
    project = await session.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="project not found")
    return project


async def _find(session: AsyncSession, project_id: UUID, path: str) -> FileModel | None:
    result = await session.execute(
        select(FileModel).where(
            FileModel.project_id == project_id, FileModel.path == path
        )
    )
    return result.scalar_one_or_none()


@router.get("/{path:path}")
async def get_file(
    project_id: UUID,
    path: str,
    session: AsyncSession = Depends(get_session),
):
    await _require_project(session, project_id)
    norm = _normalize(path)
    file = await _find(session, project_id, norm)
    if file is None:
        raise HTTPException(status_code=404, detail="file not found")
    if file.is_binary:
        media_type = mimetypes.guess_type(norm)[0] or "application/octet-stream"
        return Response(content=file.blob or b"", media_type=media_type)
    return FileText(content=file.content or "", updated_at=file.updated_at)


@router.put("/{path:path}", response_model=FileText)
async def put_file(
    project_id: UUID,
    path: str,
    body: FileWrite,
    session: AsyncSession = Depends(get_session),
) -> FileText:
    await _require_project(session, project_id)
    norm = _normalize(path)
    file = await _find(session, project_id, norm)
    if file is not None and file.is_binary:
        raise HTTPException(status_code=422, detail="path holds a binary file")
    if file is None:
        file = FileModel(
            project_id=project_id, path=norm, is_binary=False, content=body.content
        )
        session.add(file)
    else:
        file.content = body.content
    await session.commit()
    await session.refresh(file)
    return FileText(content=file.content or "", updated_at=file.updated_at)


@router.post("", response_model=TreeNode, status_code=201)
async def upload_file(
    project_id: UUID,
    path: str = Form(...),
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
) -> TreeNode:
    await _require_project(session, project_id)
    norm = _normalize(path)
    data = await file.read()
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="file exceeds upload cap")
    existing = await _find(session, project_id, norm)
    if existing is None:
        existing = FileModel(
            project_id=project_id, path=norm, is_binary=True, blob=data
        )
        session.add(existing)
    else:
        existing.is_binary = True
        existing.content = None
        existing.blob = data
    await session.commit()
    await session.refresh(existing)
    return TreeNode(
        path=existing.path,
        is_binary=True,
        size=len(data),
        updated_at=existing.updated_at,
    )


@router.delete("/{path:path}", status_code=204)
async def delete_file(
    project_id: UUID,
    path: str,
    session: AsyncSession = Depends(get_session),
) -> Response:
    await _require_project(session, project_id)
    norm = _normalize(path)
    file = await _find(session, project_id, norm)
    if file is None:
        raise HTTPException(status_code=404, detail="file not found")
    await session.delete(file)
    await session.commit()
    return Response(status_code=204)
