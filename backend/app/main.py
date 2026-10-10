"""FastAPI application factory."""

import asyncio
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

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


def _mount_spa(app: FastAPI, static_dir: Path) -> None:
    """Serve the built SPA: hashed assets plus an index.html fallback.

    Registered after the API routers, so ``/api/*`` keeps precedence. No-op
    when the directory is absent (backend-only dev, or tests).
    """
    if not static_dir.is_dir():
        return

    index_file = static_dir / "index.html"
    assets_dir = static_dir / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str) -> FileResponse:
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="not found")
        candidate = static_dir / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        if index_file.is_file():
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="not found")


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

    _mount_spa(app, Path(settings.static_dir))

    return app


app = create_app()
