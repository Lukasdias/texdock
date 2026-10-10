"""FastAPI application factory."""

from fastapi import FastAPI

from app.config import settings


def create_app() -> FastAPI:
    app = FastAPI(title="texdock")
    app.state.settings = settings

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
