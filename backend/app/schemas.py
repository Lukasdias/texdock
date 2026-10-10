"""Pydantic request/response schemas shared by the API and services."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

Engine = Literal["pdflatex", "xelatex", "lualatex"]


class ProjectCreate(BaseModel):
    name: str
    engine: Engine = "pdflatex"


class ProjectUpdate(BaseModel):
    name: str | None = None
    engine: Engine | None = None
    main_file: str | None = None


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    engine: str
    main_file: str
    created_at: datetime
    updated_at: datetime
    last_status: str | None = None


class TreeNode(BaseModel):
    path: str
    is_binary: bool
    size: int
    updated_at: datetime


class FileText(BaseModel):
    content: str
    updated_at: datetime


class Problem(BaseModel):
    kind: Literal["error", "warning"]
    file: str | None = None
    line: int | None = None
    message: str


class CompileStatus(BaseModel):
    status: str
    problems: list[Problem] = []
    finished_at: datetime | None = None


class SynctexForward(BaseModel):
    page: int
    x: float
    y: float


class SynctexInverse(BaseModel):
    file: str
    line: int
