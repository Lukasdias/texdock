"""The SPA fallback must serve only files inside the static directory."""

from pathlib import Path

from httpx import ASGITransport, AsyncClient

import app.config as config
from app.main import create_app


def _client(tmp_path: Path, monkeypatch) -> AsyncClient:
    static = tmp_path / "static"
    static.mkdir()
    (static / "index.html").write_text('<div id="root"></div>', encoding="utf-8")
    (static / "app.js").write_text("console.log('hi')", encoding="utf-8")
    (tmp_path / "secret.txt").write_text("TOP SECRET", encoding="utf-8")
    monkeypatch.setattr(config.settings, "static_dir", static)
    application = create_app()
    return AsyncClient(transport=ASGITransport(app=application), base_url="http://test")


async def test_spa_serves_index_assets_and_deep_links(tmp_path, monkeypatch):
    async with _client(tmp_path, monkeypatch) as client:
        assert '<div id="root">' in (await client.get("/")).text
        assert (await client.get("/app.js")).text == "console.log('hi')"
        assert '<div id="root">' in (await client.get("/projects/abc")).text
        assert (await client.get("/api/health")).json() == {"status": "ok"}


async def test_spa_fallback_blocks_traversal(tmp_path, monkeypatch):
    async with _client(tmp_path, monkeypatch) as client:
        # percent-encoded traversal must not escape the static directory
        escaped = await client.get("/%2e%2e/secret.txt")
        assert escaped.status_code == 404
        assert "TOP SECRET" not in escaped.text

        absolute = await client.get("/%2e%2e/%2e%2e/%2e%2e/%2e%2e/etc/passwd")
        assert absolute.status_code == 404
        assert "root:" not in absolute.text
