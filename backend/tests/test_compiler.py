import asyncio
import os
import time
import uuid

import pytest
from app.models import File
from app.latex.compiler import compile_project


def tex(path, content):
    return File(project_id=None, path=path, is_binary=False, content=content)


GOOD = tex("main.tex", "\\documentclass{article}\\begin{document}Hi\\end{document}\n")


@pytest.mark.latex
async def test_good_project_compiles(tmp_path):
    r = await compile_project([GOOD], "main.tex", "pdflatex", 120, tmp_path)
    assert r.success and r.pdf and r.pdf[:4] == b"%PDF" and r.synctex


@pytest.mark.latex
async def test_bad_project_reports_problems(tmp_path):
    bad = tex("main.tex", "\\documentclass{article}\\begin{document}\\badcmd\\end{document}\n")
    r = await compile_project([bad], "main.tex", "pdflatex", 120, tmp_path)
    assert r.success is False and any(p.kind == "error" for p in r.problems)


def _processes_matching(token: str) -> list[int]:
    found = []
    for pid in os.listdir("/proc"):
        if not pid.isdigit():
            continue
        try:
            with open(f"/proc/{pid}/cmdline", "rb") as handle:
                cmdline = handle.read().replace(b"\x00", b" ").decode(errors="replace")
        except OSError:
            continue
        if token in cmdline:
            found.append(int(pid))
    return found


@pytest.mark.latex
async def test_runaway_document_times_out(tmp_path):
    token = f"runaway-{uuid.uuid4().hex}"
    loop = tex(f"{token}.tex",
               "\\documentclass{article}\\begin{document}\\loop\\iftrue\\repeat\\end{document}\n")
    start = time.monotonic()
    r = await compile_project([loop], f"{token}.tex", "pdflatex", 5, tmp_path)
    assert r.success is False
    assert time.monotonic() - start < 30  # returned promptly, did not hang
    # No orphan latexmk/pdflatex for this document survives the process-group kill.
    for _ in range(40):
        if not _processes_matching(token):
            break
        await asyncio.sleep(0.05)
    assert _processes_matching(token) == []


@pytest.mark.latex
async def test_filename_with_spaces_compiles(tmp_path):
    main = tex("my paper.tex", "\\documentclass{article}\\begin{document}Ok\\end{document}\n")
    r = await compile_project([main], "my paper.tex", "pdflatex", 120, tmp_path)
    assert r.success
