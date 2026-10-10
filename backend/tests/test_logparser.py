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
