"""Per-project compile queue.

A single worker drains a global FIFO of project ids, so compiles never overlap
and a project's jobs stay ordered. Each job persists a Compilation row
(running -> success|error), broadcasts status over the WebSocket, and prunes
each project to the N most recent rows.
"""

import asyncio
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import delete, select

from app.latex.compiler import compile_project
from app.models import Compilation, File, Project
from app.ws import ConnectionManager


class CompileQueue:
    def __init__(self, session_factory, manager: ConnectionManager, settings) -> None:
        self._session_factory = session_factory
        self._manager = manager
        self._settings = settings
        self._queue: asyncio.Queue[UUID] = asyncio.Queue()

    async def enqueue(self, project_id: UUID) -> None:
        await self._queue.put(project_id)
        await self._manager.broadcast(project_id, {"status": "queued", "problems": []})

    async def run_forever(self) -> None:
        while True:
            project_id = await self._queue.get()
            try:
                await self._run_job(project_id)
            except Exception:
                # A failed job must not kill the worker.
                pass
            finally:
                self._queue.task_done()

    async def _run_job(self, project_id: UUID) -> None:
        async with self._session_factory() as session:
            project = await session.get(Project, project_id)
            if project is None:
                return

            result = await session.execute(
                select(File).where(File.project_id == project_id)
            )
            files = list(result.scalars().all())

            compilation = Compilation(project_id=project_id, status="running")
            session.add(compilation)
            await session.commit()

            await self._manager.broadcast(
                project_id, {"status": "running", "problems": []}
            )

            outcome = await compile_project(
                files,
                project.main_file,
                project.engine,
                self._settings.compile_timeout_seconds,
                self._settings.compile_root,
            )

            compilation.status = "success" if outcome.success else "error"
            compilation.log = outcome.log
            compilation.pdf = outcome.pdf
            compilation.synctex = outcome.synctex
            compilation.finished_at = datetime.now(timezone.utc)
            await session.commit()

            await self._prune(session, project_id)

            await self._manager.broadcast(
                project_id,
                {
                    "status": compilation.status,
                    "problems": [p.model_dump() for p in outcome.problems],
                },
            )

    async def _prune(self, session, project_id: UUID) -> None:
        keep = self._settings.max_compilations_per_project
        result = await session.execute(
            select(Compilation.id)
            .where(Compilation.project_id == project_id)
            .order_by(Compilation.started_at.desc())
            .offset(keep)
        )
        stale_ids = list(result.scalars().all())
        if stale_ids:
            await session.execute(
                delete(Compilation).where(Compilation.id.in_(stale_ids))
            )
            await session.commit()
