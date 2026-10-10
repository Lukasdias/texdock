import asyncio
import uuid

from app.jobs import CompileQueue
from app.ws import ConnectionManager
from app.latex.compiler import CompileResult
from app.models import File, Project


async def test_jobs_serialized_and_not_lost(
    monkeypatch, session, session_factory, settings
):
    order = []

    async def fake_compile(files, main_file, engine, timeout, work_root):
        order.append("start")
        await asyncio.sleep(0.05)
        order.append("end")
        return CompileResult(success=True, log="", problems=[], pdf=b"%PDF", synctex=b"s")

    monkeypatch.setattr("app.jobs.compile_project", fake_compile)
    queue = CompileQueue(session_factory, ConnectionManager(), settings)

    project = Project(id=uuid.uuid4(), name="demo", engine="pdflatex", main_file="main.tex")
    session.add(project)
    await session.flush()
    session.add(File(project_id=project.id, path="main.tex", is_binary=False, content="x"))
    await session.commit()
    pid = project.id

    await queue.enqueue(pid)
    await queue.enqueue(pid)  # second must not be dropped

    task = asyncio.create_task(queue.run_forever())
    for _ in range(200):
        if len(order) == 4:
            break
        await asyncio.sleep(0.02)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    assert order == ["start", "end", "start", "end"]  # serialized, none lost
