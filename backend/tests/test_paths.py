import pytest
from app.paths import normalize_project_path, InvalidPathError


@pytest.mark.parametrize("raw,expected", [
    ("main.tex", "main.tex"),
    ("chapters/intro.tex", "chapters/intro.tex"),
    ("fig/../fig/a.png", "fig/a.png"),
    ("a\\b.tex", "a/b.tex"),
])
def test_accepts_and_normalizes(raw, expected):
    assert normalize_project_path(raw) == expected


@pytest.mark.parametrize("raw", ["", "/etc/passwd", "../x", "a/../../b", "..", "./..", "a/.."])
def test_rejects_unsafe(raw):
    with pytest.raises(InvalidPathError):
        normalize_project_path(raw)
