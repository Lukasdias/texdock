"""Turn a latexmk/TeX `.log` into a structured list of Problems.

Strategy: track the currently-open input file from `(./file` tokens, start an
error at the first non-space `!` marker line, take the line number from the
following `l.NNN` line, and collect `LaTeX Warning:` lines as warnings.
"""

import re

from app.schemas import Problem

_OPEN_FILE = re.compile(r"\(\./([^\s()]+)")
_LINE_NUMBER = re.compile(r"l\.(\d+)")
_INPUT_LINE = re.compile(r"on input line (\d+)")
_WARNING_PREFIX = "LaTeX Warning:"


def parse_log(log: str) -> list[Problem]:
    problems: list[Problem] = []
    current_file: str | None = None
    lines = log.splitlines()

    for index, line in enumerate(lines):
        for match in _OPEN_FILE.finditer(line):
            current_file = match.group(1)

        stripped = line.lstrip()
        if stripped.startswith("!"):
            message = stripped[1:].strip()
            line_no = _next_line_number(lines, index)
            problems.append(
                Problem(
                    kind="error",
                    file=current_file,
                    line=line_no,
                    message=message,
                )
            )
        elif _WARNING_PREFIX in line:
            rest = line.split(_WARNING_PREFIX, 1)[1].strip()
            match = _INPUT_LINE.search(rest)
            if match:
                line_no: int | None = int(match.group(1))
                message = rest[: match.start()].strip()
            else:
                line_no = None
                message = rest
            problems.append(
                Problem(
                    kind="warning",
                    file=current_file,
                    line=line_no,
                    message=message.rstrip(".") or rest,
                )
            )

    return problems


def _next_line_number(lines: list[str], index: int) -> int | None:
    for candidate in lines[index + 1 : index + 4]:
        match = _LINE_NUMBER.match(candidate.lstrip())
        if match:
            return int(match.group(1))
    return None
