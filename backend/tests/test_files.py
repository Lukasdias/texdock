import pytest
from app.paths import InvalidPathError  # noqa: F401


async def test_text_roundtrip(client):
    pid = (await client.post("/api/projects", json={"name": "P"})).json()["id"]
    r = await client.put(f"/api/projects/{pid}/files/chapters/intro.tex", json={"content": "hi"})
    assert r.status_code == 200
    got = await client.get(f"/api/projects/{pid}/files/chapters/intro.tex")
    assert got.json()["content"] == "hi"


async def test_binary_upload_and_fetch(client):
    pid = (await client.post("/api/projects", json={"name": "P"})).json()["id"]
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
    r = await client.post(f"/api/projects/{pid}/files",
                          data={"path": "img/logo.png"}, files={"file": ("logo.png", png, "image/png")})
    assert r.status_code == 201
    got = await client.get(f"/api/projects/{pid}/files/img/logo.png")
    assert got.content == png and got.headers["content-type"].startswith("image/png")


async def test_reject_binary_body_on_text_route(client):
    pid = (await client.post("/api/projects", json={"name": "P"})).json()["id"]
    r = await client.put(f"/api/projects/{pid}/files/bad.tex",
                         content=b"\xff\xfe\x00", headers={"content-type": "application/json"})
    assert r.status_code in (400, 422)


async def test_traversal_blocked(client):
    pid = (await client.post("/api/projects", json={"name": "P"})).json()["id"]
    # Percent-encoded dot segments survive httpx URL normalization and reach
    # the {path:path} route as literal `..`, exercising the guard.
    assert (await client.get(f"/api/projects/{pid}/files/%2e%2e/%2e%2e/etc/passwd")).status_code == 400


async def test_unicode_and_space_filename(client):
    pid = (await client.post("/api/projects", json={"name": "P"})).json()["id"]
    r = await client.put(f"/api/projects/{pid}/files/chapitre 1/café.tex", json={"content": "x"})
    assert r.status_code == 200
