"""SyncTeX forward/inverse navigation via the `synctex` command line tool.

Both helpers take the latest successful PDF and its `.synctex.gz`, write the
sidecar next to the PDF, and shell out to `synctex`, parsing the `SyncTeX
result begin`/`end` block.
"""

import re
import subprocess
from pathlib import Path

from app.schemas import SynctexForward, SynctexInverse


def _run(args: list[str], work_root: Path) -> str:
    completed = subprocess.run(
        ["synctex", *args],
        cwd=str(work_root),
        capture_output=True,
        text=True,
    )
    return f"{completed.stdout}\n{completed.stderr}"


def _match(text: str, pattern: str, default: str) -> str:
    found = re.search(pattern, text)
    return found.group(1) if found else default


def _write_sidecar(pdf_path: Path, synctex_gz: bytes) -> Path:
    pdf = Path(pdf_path)
    pdf.with_suffix(".synctex.gz").write_bytes(synctex_gz)
    return pdf


def _relative_input(raw: str, work_root: Path) -> str:
    raw = raw.strip()
    if not raw:
        return ""
    path = Path(raw)
    try:
        return path.resolve().relative_to(Path(work_root).resolve()).as_posix()
    except ValueError:
        return path.name


def forward(
    file: str,
    line: int,
    pdf_path: Path,
    synctex_gz: bytes,
    work_root: Path,
) -> SynctexForward:
    pdf = _write_sidecar(pdf_path, synctex_gz)
    output = _run(["view", "-i", f"{line}:1:{file}", "-o", pdf.name], Path(work_root))
    page = int(_match(output, r"Page:(-?\d+)", "1"))
    x = float(_match(output, r"(?m)^x:([-\d.]+)", "0"))
    y = float(_match(output, r"(?m)^y:([-\d.]+)", "0"))
    return SynctexForward(page=page, x=x, y=y)


def inverse(
    page: int,
    x: float,
    y: float,
    pdf_path: Path,
    synctex_gz: bytes,
    work_root: Path,
) -> SynctexInverse:
    pdf = _write_sidecar(pdf_path, synctex_gz)
    output = _run(
        ["edit", "-o", f"{page}:{x}:{y}:{pdf.name}"], Path(work_root)
    )
    raw_input = _match(output, r"(?m)^Input:(.*)$", "")
    line = int(_match(output, r"(?m)^Line:(-?\d+)", "1"))
    return SynctexInverse(
        file=_relative_input(raw_input, Path(work_root)), line=max(line, 1)
    )
