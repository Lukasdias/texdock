import uuid

import pytest
from sqlalchemy import select  # noqa: F401
from app.models import Project, File


async def test_file_unique_per_project(session):
    p = Project(id=uuid.uuid4(), name="demo", engine="pdflatex", main_file="main.tex")
    session.add(p)
    await session.flush()
    session.add(File(project_id=p.id, path="main.tex", is_binary=False, content="x"))
    await session.commit()
    session.add(File(project_id=p.id, path="main.tex", is_binary=False, content="y"))
    with pytest.raises(Exception):  # IntegrityError
        await session.commit()
