"""Projects CRUD."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Compilation, File, Project
from app.schemas import ProjectCreate, ProjectOut, ProjectUpdate, TreeNode

router = APIRouter(prefix="/api/projects", tags=["projects"])

MAIN_TEX_SEED = (
    "\\documentclass{article}\n"
    "\\begin{document}\n"
    "Hello, texdock!\n"
    "\\end{document}\n"
)


def _file_size(file: File) -> int:
    if file.is_binary:
        return len(file.blob or b"")
    return len((file.content or "").encode("utf-8"))


def _tree_node(file: File) -> TreeNode:
    return TreeNode(
        path=file.path,
        is_binary=file.is_binary,
        size=_file_size(file),
        updated_at=file.updated_at,
    )


async def _last_status(session: AsyncSession, project_id: UUID) -> str | None:
    result = await session.execute(
        select(Compilation.status)
        .where(Compilation.project_id == project_id)
        .order_by(Compilation.started_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


def _out(project: Project, last_status: str | None) -> ProjectOut:
    out = ProjectOut.model_validate(project)
    out.last_status = last_status
    return out


@router.get("", response_model=list[ProjectOut])
async def list_projects(session: AsyncSession = Depends(get_session)) -> list[ProjectOut]:
    result = await session.execute(select(Project).order_by(Project.updated_at.desc()))
    return [_out(p, await _last_status(session, p.id)) for p in result.scalars().all()]


@router.post("", response_model=ProjectOut, status_code=201)
async def create_project(
    body: ProjectCreate, session: AsyncSession = Depends(get_session)
) -> ProjectOut:
    project = Project(name=body.name, engine=body.engine, main_file="main.tex")
    session.add(project)
    await session.flush()
    session.add(
        File(
            project_id=project.id,
            path="main.tex",
            is_binary=False,
            content=MAIN_TEX_SEED,
        )
    )
    await session.commit()
    await session.refresh(project)
    return _out(project, None)


@router.get("/{project_id}")
async def get_project(
    project_id: UUID, session: AsyncSession = Depends(get_session)
) -> dict:
    project = await session.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="project not found")
    result = await session.execute(
        select(File).where(File.project_id == project_id).order_by(File.path)
    )
    files = [_tree_node(f) for f in result.scalars().all()]
    return {
        "project": _out(project, await _last_status(session, project_id)),
        "files": files,
    }


@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: UUID,
    body: ProjectUpdate,
    session: AsyncSession = Depends(get_session),
) -> ProjectOut:
    project = await session.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="project not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    await session.commit()
    await session.refresh(project)
    return _out(project, await _last_status(session, project_id))


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: UUID, session: AsyncSession = Depends(get_session)
) -> Response:
    project = await session.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="project not found")
    await session.delete(project)
    await session.commit()
    return Response(status_code=204)
