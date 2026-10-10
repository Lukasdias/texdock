"""Materialize a project into a temp dir and run latexmk under a hard timeout.

On timeout the *entire process group* is SIGKILLed, so forking engines
(latexmk re-invokes pdflatex/xelatex/lualatex) cannot leave orphans.
"""

import asyncio
import os
import shutil
import signal
import uuid
from dataclasses import dataclass
from pathlib import Path

from app.latex.logparser import parse_log
from app.models import File
from app.schemas import Problem


@dataclass(frozen=True)
class CompileResult:
    success: bool
    log: str
    problems: list[Problem]
    pdf: bytes | None
    synctex: bytes | None


def materialize(files: list[File], dest: Path) -> None:
    """Write each project file under `dest`, creating parent directories."""
    dest.mkdir(parents=True, exist_ok=True)
    for file in files:
        target = dest / file.path
        target.parent.mkdir(parents=True, exist_ok=True)
        if file.is_binary:
            target.write_bytes(file.blob or b"")
        else:
            target.write_text(file.content or "", encoding="utf-8")


def _kill_group(proc: asyncio.subprocess.Process) -> None:
    try:
        pgid = os.getpgid(proc.pid)
    except ProcessLookupError:
        return
    try:
        os.killpg(pgid, signal.SIGKILL)
    except ProcessLookupError:
        pass


def _read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def _read_bytes(path: Path) -> bytes | None:
    try:
        return path.read_bytes()
    except OSError:
        return None


async def compile_project(
    files: list[File],
    main_file: str,
    engine: str,
    timeout_seconds: int,
    work_root: Path,
) -> CompileResult:
    workdir = Path(work_root) / uuid.uuid4().hex
    workdir.mkdir(parents=True, exist_ok=True)
    try:
        materialize(files, workdir)

        cmd = [
            "latexmk",
            f"-{engine}",
            "-synctex=1",
            "-interaction=nonstopmode",
            "-halt-on-error",
            main_file,
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=workdir,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            start_new_session=True,
        )

        timed_out = False
        stdout = b""
        try:
            stdout, _ = await asyncio.wait_for(
                proc.communicate(), timeout=timeout_seconds
            )
        except (TimeoutError, asyncio.TimeoutError):
            timed_out = True
            _kill_group(proc)
            await proc.wait()

        stem = Path(main_file).stem
        log_text = _read_text(workdir / f"{stem}.log")
        if not log_text:
            # latexmk could not run the engine (missing binary, permissions,
            # disk) and wrote no .log; keep its own diagnostics instead of
            # dropping them silently.
            log_text = stdout.decode("utf-8", errors="replace")
        pdf = _read_bytes(workdir / f"{stem}.pdf")
        synctex = _read_bytes(workdir / f"{stem}.synctex.gz")

        problems = parse_log(log_text)
        if timed_out:
            problems.append(
                Problem(
                    kind="error",
                    file=main_file,
                    line=None,
                    message=f"Compilation exceeded {timeout_seconds}s and was killed",
                )
            )

        # A compile succeeds when it produced a PDF (unless it timed out) and
        # the log parsed no errors. latexmk's exit code is not trusted alone:
        # a clean document can still yield a nonzero exit in some environments.
        has_errors = any(problem.kind == "error" for problem in problems)
        success = not timed_out and pdf is not None and not has_errors
        if not success and not has_errors:
            problems.append(
                Problem(
                    kind="error",
                    file=main_file,
                    line=None,
                    message="Compilation failed; see the log for details.",
                )
            )
        return CompileResult(
            success=success,
            log=log_text,
            problems=problems,
            pdf=pdf,
            synctex=synctex,
        )
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
