# texdock

A self-hosted, dockerized LaTeX editor for personal use. It runs as a single
Docker image plus Postgres on a local machine and provides the core Overleaf
workflow: a project with multiple source files and binary assets, in-browser
editing, live PDF preview, compile-error reporting, two-way SyncTeX navigation,
and PDF export.

**Scope:** single user, loopback-only, no accounts. It is not designed to be
exposed to a LAN or the public internet.

## Why this exists

Self-hosting Overleaf Community Edition works, but it is heavy: a compose stack
with MongoDB, Redis, and several services, roughly 4 GB of RAM, and a
multi-step setup with a reverse proxy. `texdock` targets the case where one
person wants a local LaTeX editor: one image, one database, one command,
bound to `127.0.0.1`. The trade-off is deliberate — no multi-user, no real-time
collaboration, no git integration.

## Screenshots

| Project grid | Editor and PDF preview |
| --- | --- |
| ![Project grid](https://github.com/user-attachments/assets/063a7f0e-0143-4f11-b703-dfe7e4695bda) | ![Editor and PDF preview](https://github.com/user-attachments/assets/f4700fa1-28db-4b84-bc5e-64614f7b33f9) |

## Feature matrix

| Capability | texdock | Overleaf CE (self-hosted) | Overleaf (cloud) |
| --- | --- | --- | --- |
| Deployment shape | one app image + Postgres | docker-compose, many services | SaaS |
| Typical idle RAM | ~200-400 MB | ~4 GB+ | n/a |
| Setup | `docker compose up --build` | multi-step, env + reverse proxy | sign up |
| Accounts / auth | none (single user) | accounts (configurable) | accounts + teams |
| Network exposure | loopback only by design | operator-configured | public |
| Real-time collaboration | no | yes | yes |
| Project file tree + binary assets | yes | yes | yes |
| Editor | CodeMirror 6 | CodeMirror / ACE | CodeMirror |
| Live PDF preview | yes (auto-compile, debounced) | yes | yes |
| TeX engines | pdflatex, xelatex, lualatex | pdflatex, xelatex, lualatex | pdflatex, xelatex, lualatex |
| SyncTeX forward/inverse | yes | yes | yes |
| Compile-error panel | yes (parsed `.log`) | yes (richer) | yes |
| PDF export / download | yes | yes | yes |
| Version history | no (retains 10 recent compiles) | yes | yes |
| Git integration | no | limited | yes |
| Template gallery | no | some | yes |
| Bibliography manager UI | no (raw `.bib`) | some | yes |
| Offline / LAN use | yes | yes | no |
| License | not declared (personal project) | AGPL-3.0 | proprietary |

Overleaf CE is a mature, full-featured platform. `texdock` is intentionally
smaller; pick Overleaf CE if you need collaboration, history, or a multi-user
instance, and `texdock` if you want a single-user local editor with minimal
operations.

## Stack

- **Backend:** Python 3.13, FastAPI, uv, SQLAlchemy 2 (async) over PostgreSQL 17,
  `latexmk` with Debian TeX Live. Postgres is the single source of truth for
  projects, files, and compile artifacts.
- **Frontend:** React 19, Vite 8, TanStack Router + Query, CodeMirror 6,
  Tailwind 4, shadcn/ui, pdfjs-dist, Motion, Sonner, React Compiler.
- **Runtime:** one multi-stage image (Bun builds the SPA, then a Python + TeX
  Live runtime serves `/`, `/api/*`, and `/api/ws/*`).

## Requirements

- Docker with the Compose plugin.
- Host port `8000` free (published loopback-only as `127.0.0.1:8000`).

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

Open `http://127.0.0.1:8000`. The first build installs TeX Live, so it takes
several minutes and produces a large image (TeX Live dominates the size).

## Usage

- **Projects** — create from the project grid; each seeds a minimal `main.tex`.
- **Files and assets** — create, edit, upload, and delete in the file tree.
  Text files edit in-browser; binary assets upload through the tree.
- **Compile** — auto-compiles about 2 s after you stop typing, or `Ctrl+S` to
  save and compile immediately. The last successful PDF stays visible when a
  compile fails.
- **Problems** — parsed compile errors are listed; click one to open the file
  and line.
- **SyncTeX** — ctrl/⌘-click in the PDF jumps to the source line; "Sync to PDF"
  (or `Ctrl+Alt+J`) at the cursor scrolls the PDF to the matching location.
- **Export** — the toolbar download button fetches the current PDF.

## Architecture

```
browser ──HTTP/WS──> FastAPI ──SQL──> Postgres
                        │
                        └─ latexmk (temp dir) ─> pdf + log + .synctex.gz ─> Postgres
```

- The app materializes a project into a temp directory, runs
  `latexmk -<engine> -synctex=1 -interaction=nonstopmode -halt-on-error`, and
  stores the PDF, log, and SyncTeX data in Postgres.
- Compiles are queued per project (one job at a time) and results are pushed to
  the browser over a WebSocket.
- A compile that exceeds 120 s has its whole process group killed.

## API (summary)

- `GET /api/health`
- `GET|POST /api/projects`
- `GET|PATCH|DELETE /api/projects/{id}`
- `GET|PUT|DELETE /api/projects/{id}/files/{path}`
- `POST /api/projects/{id}/files` (multipart upload, 50 MB cap)
- `POST /api/projects/{id}/compile`
- `GET /api/projects/{id}/pdf` (`?download=1` to download)
- `GET /api/projects/{id}/synctex`
- `GET /api/projects/{id}/log`
- `GET /api/projects/{id}/synctex/forward?file=&line=`
- `GET /api/projects/{id}/synctex/inverse?page=&x=&y=`
- `WS /api/ws/{id}` — compile status events (`{status, problems}`)

## Configuration

`.env` (copied from `.env.example`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `POSTGRES_USER` | `texdock` | database user |
| `POSTGRES_PASSWORD` | `texdock` | database password |
| `POSTGRES_DB` | `texdock` | database name |

Backend settings (env-overridable): `DATABASE_URL`,
`COMPILE_TIMEOUT_SECONDS` (120), `MAX_UPLOAD_BYTES` (50 MB),
`MAX_COMPILATIONS_PER_PROJECT` (10), `COMPILE_ROOT`, `STATIC_DIR`.

## Tests

Backend (needs a reachable Postgres; `latex`-marked tests need `latexmk`):

```bash
cd backend
TEST_DATABASE_URL=postgresql+asyncpg://texdock:texdock@localhost:55432/texdock_test \
  uv run pytest
```

Start a test database on `55432` if needed:

```bash
docker run -d --name texdock-testpg \
  -e POSTGRES_USER=texdock -e POSTGRES_PASSWORD=texdock -e POSTGRES_DB=texdock_test \
  -p 55432:5432 postgres:17-alpine
```

Or run the suite inside the dev image (the `db` service starts automatically):

```bash
docker compose --profile dev run --rm backend-dev uv run pytest
```

Frontend:

```bash
cd frontend
bun run vitest run
bun run build
```

Production smoke test (stack must be up):

```bash
bash prod-smoke.sh
```

## Backup

Postgres is the only stateful store, so a logical dump is a complete backup:

```bash
docker compose exec -T db pg_dump -U texdock texdock > texdock-$(date +%F).sql
```

Restore with `psql` against the same database.

## Non-goals

Multi-user accounts, permissions, real-time collaboration, version history,
git integration, a template gallery, and public deployment. Files are
last-write-wins. See the matrix for what a full Overleaf deployment adds.
