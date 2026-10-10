"""SQLAlchemy 2.0 ORM models. Postgres is the single source of truth."""

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, LargeBinary, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column()
    engine: Mapped[str] = mapped_column(default="pdflatex")
    main_file: Mapped[str] = mapped_column(default="main.tex")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )


class File(Base):
    __tablename__ = "files"
    __table_args__ = (
        UniqueConstraint("project_id", "path", name="uq_files_project_path"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE")
    )
    path: Mapped[str] = mapped_column()
    is_binary: Mapped[bool] = mapped_column(default=False)
    content: Mapped[str | None] = mapped_column(nullable=True)
    blob: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )


class Compilation(Base):
    __tablename__ = "compilations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE")
    )
    status: Mapped[str] = mapped_column(default="queued")
    log: Mapped[str | None] = mapped_column(nullable=True)
    pdf: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    synctex: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    started_at: Mapped[datetime] = mapped_column(server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(nullable=True)
