# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1: build the React SPA.
# ---------------------------------------------------------------------------
FROM oven/bun:1 AS frontend-build
WORKDIR /frontend
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile
COPY frontend/ ./
RUN bun run build

# ---------------------------------------------------------------------------
# Stage 2: runtime — FastAPI + uv + TeX Live, serving API, WS and the SPA.
# ---------------------------------------------------------------------------
FROM python:3.13-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    UV_PYTHON_DOWNLOADS=0 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        texlive-latex-base \
        texlive-latex-recommended \
        texlive-latex-extra \
        texlive-xetex \
        texlive-fonts-recommended \
        texlive-fonts-extra \
        texlive-bibtex-extra \
        latexmk \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.13.0 /uv /uvx /usr/local/bin/

WORKDIR /app

COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev

COPY backend/app ./app
COPY --from=frontend-build /frontend/dist ./static

EXPOSE 8000

CMD ["uv", "run", "--no-dev", "uvicorn", "app.main:create_app", \
     "--factory", "--host", "0.0.0.0", "--port", "8000"]
