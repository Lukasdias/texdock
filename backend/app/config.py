"""Application settings (pydantic-settings, no env prefix).

DB-free by design: importing this module must never pull in SQLAlchemy so that
lightweight entrypoints (health checks, tooling) stay importable without a DB.
"""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="", extra="ignore")

    database_url: str = "postgresql+asyncpg://texdock:texdock@db:5432/texdock"
    compile_timeout_seconds: int = 120
    max_upload_bytes: int = 50 * 1024 * 1024
    max_compilations_per_project: int = 10
    compile_root: Path = Path("/tmp/texdock-compile")
    static_dir: Path = Path("/app/static")


settings = Settings()
