"""Shared test fixtures.

Ruling: the suite runs against a real Postgres test database (not a container),
defaulting to port 55432 (host 5432 is occupied). Override with the
``TEST_DATABASE_URL`` environment variable.
"""

import os

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://texdock:texdock@localhost:55432/texdock_test",
)
# Force the app's settings onto the test database before any app import, so a
# stray DATABASE_URL can never point tests at a real database.
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from urllib.parse import urlsplit, urlunsplit  # noqa: E402

import asyncpg  # noqa: E402
import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool  # noqa: E402

import app.models  # noqa: E402,F401  (register tables on Base.metadata)
from app.config import settings as app_settings  # noqa: E402
from app.db import Base  # noqa: E402
from app.main import create_app  # noqa: E402


def _split(url: str) -> tuple[str, str]:
    """Return (admin_url_for_postgres_db, database_name) for an asyncpg URL."""
    parts = urlsplit(url.replace("+asyncpg", ""))
    database = parts.path.lstrip("/")
    admin = urlunsplit((parts.scheme, parts.netloc, "/postgres", "", ""))
    return admin, database


async def _ensure_database(url: str) -> None:
    admin, database = _split(url)
    conn = await asyncpg.connect(admin)
    try:
        exists = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1", database
        )
        if not exists:
            await conn.execute(f'CREATE DATABASE "{database}"')
    finally:
        await conn.close()


async def _create_schema(url: str) -> None:
    engine = create_async_engine(url)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    finally:
        await engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def _prepare_database():
    import asyncio

    asyncio.run(_ensure_database(TEST_DATABASE_URL))
    asyncio.run(_create_schema(TEST_DATABASE_URL))
    yield


@pytest.fixture
def settings():
    return app_settings


@pytest.fixture
async def engine():
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    try:
        yield engine
    finally:
        await engine.dispose()


@pytest.fixture
async def session_factory(engine):
    return async_sessionmaker(engine, expire_on_commit=False)


@pytest.fixture
async def session(session_factory):
    async with session_factory() as session:
        for table in reversed(Base.metadata.sorted_tables):
            await session.execute(table.delete())
        await session.commit()
        yield session


@pytest.fixture
async def app():
    application = create_app()
    async with application.router.lifespan_context(application):
        yield application


@pytest.fixture
async def client(app):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client
