async def test_create_seeds_main_tex(client):
    r = await client.post("/api/projects", json={"name": "Paper"})
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Paper" and body["engine"] == "pdflatex"
    files = (await client.get(f"/api/projects/{body['id']}")).json()["files"]
    assert [f["path"] for f in files] == ["main.tex"]


async def test_delete_cascades(client):
    pid = (await client.post("/api/projects", json={"name": "X"})).json()["id"]
    assert (await client.delete(f"/api/projects/{pid}")).status_code == 204
    assert (await client.get(f"/api/projects/{pid}")).status_code == 404
