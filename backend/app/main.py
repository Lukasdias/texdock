"""FastAPI application factory."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings
from app.db import engine, init_db
from app.routers import files, projects


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    # Release pooled connections so a subsequent app instance (e.g. in tests,
    # on a fresh event loop) never reuses a connection bound to a dead loop.
    await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(title="texdock", lifespan=lifespan)
    app.state.settings = settings

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(projects.router)
    app.include_router(files.router)

    return app


app = create_app()
