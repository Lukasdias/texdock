# texdock

Self-hosted, dockerized LaTeX editor. Single-user, loopback-only, no accounts.

One image serves the React SPA, the REST API, the compile WebSocket, and runs
`latexmk`. Postgres is the single source of truth for projects, files, and
compile artifacts. A project holds any number of source files and binary
assets; edits auto-compile after a short debounce and refresh the PDF preview
in place, with two-way SyncTeX navigation between source and PDF.

Backend: Python 3.13, FastAPI, uv, SQLAlchemy 2 (async) over Postgres 17, and
`latexmk` with Debian TeX Live. Frontend: React 19, Vite 8, TanStack
Router/Query, CodeMirror 6, Tailwind 4, shadcn/ui, pdfjs-dist.

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

## Services

- `db` — `postgres:17-alpine`, data in the named volume `pgdata`. Not published.
- `app` — the single multi-stage image (repo-root `Dockerfile`): builds the SPA
  with Bun, then the FastAPI + TeX Live runtime. Serves `/`, `/api/*` and
  `/api/ws/*` on `127.0.0.1:8000`.

## Usage

- **Projects**: create from the project grid; each seeds a minimal `main.tex`.
- **Files/assets**: create, edit, upload, delete in the file tree. Text files
  edit in-browser; binary assets (images, etc.) upload via the tree.
- **Compile**: auto-compiles ~2 s after you stop typing, or `Ctrl+S` for
  save-and-compile now. The last good PDF stays visible when a compile fails.
- **Problems**: parsed compile errors are listed; click to open the file/line.
- **SyncTeX**: ctrl/⌘-click in the PDF jumps to the source line; "Sync to PDF"
  (or `Ctrl+Alt+J`) at the cursor jumps the PDF to the matching location.
- **Export**: the toolbar download button fetches the current PDF.

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

## Tests

Backend (needs a reachable Postgres and, for `latex`-marked tests, `latexmk`):

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

Or run the same suite inside the dev image (`db` is started automatically):

```bash
docker compose --profile dev run --rm backend-dev uv run pytest
```

Frontend:

```bash
cd frontend
bun run vitest run
bun run build
```

## Backup

Postgres is the only stateful store, so a logical dump is a complete backup:

```bash
docker compose exec -T db pg_dump -U texdock texdock > texdock-$(date +%F).sql
```

Restore with `psql` against the same database.
