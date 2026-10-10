"""FastAPI application factory."""

import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI

from app.config import settings
from app.db import SessionLocal, engine, init_db
from app.jobs import CompileQueue
from app.routers import compile as compile_router
from app.routers import files, projects
from app.ws import ConnectionManager


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()

    manager = ConnectionManager()
    queue = CompileQueue(SessionLocal, manager, settings)
    app.state.ws_manager = manager
    app.state.compile_queue = queue
    worker = asyncio.create_task(queue.run_forever())

    try:
        yield
    finally:
        worker.cancel()
        with suppress(asyncio.CancelledError):
            await worker
        # Release pooled connections so a subsequent app instance (e.g. in
        # tests, on a fresh event loop) never reuses a connection bound to a
        # dead loop.
        await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(title="texdock", lifespan=lifespan)
    app.state.settings = settings

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(projects.router)
    app.include_router(files.router)
    app.include_router(compile_router.router)
    app.include_router(compile_router.ws_router)

    return app


app = create_app()
