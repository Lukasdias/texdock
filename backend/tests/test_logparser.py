from app.latex.logparser import parse_log
from app.schemas import Problem


def test_no_errors_returns_empty():
    assert parse_log("This is pdfTeX, Version 3.14\nOutput written on main.pdf") == []


def test_parses_error_with_line_and_file():
    log = ("(./main.tex\n"
           "! Undefined control sequence.\n"
           "l.12 \\badcommand\n")
    problems = parse_log(log)
    assert problems == [Problem(kind="error", file="main.tex", line=12,
                                message="Undefined control sequence.")]


def test_parses_warning():
    log = "LaTeX Warning: Reference `x' on page 1 undefined on input line 7.\n"
    problems = parse_log(log)
    assert problems[0].kind == "warning" and problems[0].line == 7


def test_ignores_system_and_non_file_parentheticals():
    # `(size option)` and `(Default extension: sty)` are not file opens; the
    # system .cls/.clo paths are not project files either. The error should be
    # attributed to the project file that is actually open.
    log = (
        "(./main.tex\n"
        "(/usr/share/texlive/texmf-dist/tex/latex/base/article.cls\n"
        "File: size10.clo 2024/06/29 v1.4n Standard LaTeX file (size option)\n"
        ")\n"
        "! LaTeX Error: File `cv-common.sty' not found.\n"
        "or enter new name. (Default extension: sty)\n"
        "! Emergency stop.\n"
        "l.3 \\begin{document}\n"
    )
    problems = parse_log(log)
    assert [p.file for p in problems] == ["main.tex", "main.tex"]
    assert problems[0].message == "LaTeX Error: File `cv-common.sty' not found."

