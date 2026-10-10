"""Project path normalization and traversal guard.

A project file path is always a POSIX-style path relative to the project root.
Any input whose normalized form is absolute, empty, or escapes the root (a
remaining ``..`` segment) is rejected.
"""

import posixpath
from pathlib import PurePosixPath


class InvalidPathError(ValueError):
    """Raised when a path cannot be safely resolved inside a project root."""


def normalize_project_path(raw: str) -> str:
    if not isinstance(raw, str):
        raise InvalidPathError("path must be a string")

    # Treat backslashes as separators so Windows-style input cannot smuggle
    # a traversal past the check.
    candidate = raw.replace("\\", "/")
    normalized = posixpath.normpath(candidate)

    if normalized in ("", "."):
        raise InvalidPathError("empty path")
    if posixpath.isabs(normalized):
        raise InvalidPathError("absolute path")
    if ".." in PurePosixPath(normalized).parts:
        raise InvalidPathError("path escapes the project root")

    return normalized
