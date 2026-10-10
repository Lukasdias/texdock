from httpx import ASGITransport, AsyncClient
from app.main import create_app


async def test_health():
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
