import asyncio

import pytest


async def _poll_success(client, pid, timeout=30.0):
    last = None
    for _ in range(int(timeout / 0.1)):
        last = (await client.get(f"/api/projects/{pid}/log")).json()
        if last.get("status") == "success":
            return last
        await asyncio.sleep(0.1)
    raise AssertionError(f"compile never succeeded; last={last}")


@pytest.mark.latex
async def test_forward_and_inverse(client):
    pid = (await client.post("/api/projects", json={"name": "P"})).json()["id"]
    await client.post(f"/api/projects/{pid}/compile")
    await _poll_success(client, pid)

    fwd = (await client.get(f"/api/projects/{pid}/synctex/forward?file=main.tex&line=1")).json()
    assert fwd["page"] >= 1

    inv = (
        await client.get(
            f"/api/projects/{pid}/synctex/inverse?page={fwd['page']}&x={fwd['x']}&y={fwd['y']}"
        )
    ).json()
    assert inv["file"].endswith(".tex") and inv["line"] >= 1
