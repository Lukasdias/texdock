import asyncio

import pytest


async def _poll_status(client, pid, want, timeout=30.0):
    """Poll /log until the newest compilation reports `want`."""
    last = None
    for _ in range(int(timeout / 0.1)):
        last = (await client.get(f"/api/projects/{pid}/log")).json()
        if last.get("status") == want:
            return last
        await asyncio.sleep(0.1)
    raise AssertionError(f"compile never reached {want!r}; last={last}")


@pytest.mark.latex
async def test_pdf_before_compile_is_404(client):
    pid = (await client.post("/api/projects", json={"name": "P"})).json()["id"]
    assert (await client.get(f"/api/projects/{pid}/pdf")).status_code == 404


@pytest.mark.latex
async def test_compile_then_pdf_and_download(client):
    pid = (await client.post("/api/projects", json={"name": "P"})).json()["id"]
    assert (await client.post(f"/api/projects/{pid}/compile")).status_code == 202
    await _poll_status(client, pid, "success")
    pdf = await client.get(f"/api/projects/{pid}/pdf")
    assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"
    dl = await client.get(f"/api/projects/{pid}/pdf?download=1")
    assert "attachment" in dl.headers["content-disposition"]


@pytest.mark.latex
async def test_failed_compile_keeps_last_good_pdf(client):
    pid = (await client.post("/api/projects", json={"name": "P"})).json()["id"]
    await client.post(f"/api/projects/{pid}/compile")
    await _poll_status(client, pid, "success")
    good = (await client.get(f"/api/projects/{pid}/pdf")).content
    assert good[:4] == b"%PDF"

    await client.put(
        f"/api/projects/{pid}/files/main.tex",
        json={"content": "\\documentclass{article}\\begin{document}\\badcmd\\end{document}\n"},
    )
    await client.post(f"/api/projects/{pid}/compile")
    log = await _poll_status(client, pid, "error")
    assert any(p["kind"] == "error" for p in log["problems"])

    after = await client.get(f"/api/projects/{pid}/pdf")
    assert after.status_code == 200 and after.content == good
