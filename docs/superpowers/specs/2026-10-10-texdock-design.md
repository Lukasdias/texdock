# texdock — Design Spec

Date: 2026-10-10
Status: Approved (design phase)

## Purpose

A self-hosted, dockerized LaTeX editor for personal local use. Provides the
core Overleaf workflow — project with many files/assets, LaTeX source editing,
live PDF preview, and PDF export — without Overleaf's operational weight.

## Intent and Success Criteria

Intended outcome: one `docker compose up` on a local machine yields a working
web app where the user can create a LaTeX project, edit its files in-browser,
see the compiled PDF update automatically, click between PDF and source via
SyncTeX, and download the PDF.

Success criteria:

- Single-command startup, no external accounts or services.
- Editing a file auto-compiles after a short debounce and refreshes the PDF.
- Compile errors are shown with file/line and clickable to the source.
- Two-way SyncTeX navigation works (PDF click → source line; cursor → PDF).
- PDF can be exported/downloaded.
- Everything persists across container restarts.

Non-goals (v1):

- Multi-user accounts, auth, permissions.
- Real-time collaborative editing.
- Hosted/public deployment.
- SyncTeX, PDF, and project files are single-user, last-write-wins.

## Environment and Constraints

- Personal, local-only use. Port bound to `127.0.0.1` so it is not LAN-exposed.
- Everything dockerized via `docker-compose.yml`.
- Backend: Python + FastAPI + uv.
- Database: PostgreSQL (single source of truth for projects, files, compiles).
- Frontend: React + Vite 8, TanStack Router, TanStack Query, CodeMirror 6,
  Tailwind, shadcn/ui, Motion, Sonner, React Compiler.
- LaTeX toolchain: `latexmk` + Debian TeX Live packages inside the app image.
- No authentication in v1. An optional bearer token can be added later.

## Architecture

Two docker-compose services:

- `db` — `postgres:17-alpine`, named volume `pgdata`.
- `app` — custom image:
  - Stage 1 (frontend build): bun — `bun install`, `vite build` → static assets.
  - Stage 2 (runtime): `python:3.13-slim` + uv + Debian TeX Live + app code.
  - FastAPI under uvicorn serves the built React statics at `/`, the REST API
    at `/api/*`, and the WebSocket at `/api/ws/{project_id}`.
  - Image size target ~2GB (TeX Live dominates). Port publish
    `127.0.0.1:8000:8000`.

Data flow:

```
browser ──HTTP/WS──> FastAPI ──SQL──> Postgres
                        │
                        └─ subprocess latexmk (temp dir) ─> pdf + log + synctex
                                                        ─> Postgres
```

The database is the only stateful store. Backup is `pg_dump`; there is no
file volume to drift.

## Data Model

```sql
projects:     id uuid pk, name text, engine text (pdflatex|xelatex|lualatex),
              main_file text, created_at, updated_at

files:        id uuid pk, project_id uuid fk, path text (relative),
              is_binary bool, content text null, blob bytea null, updated_at
              unique (project_id, path)

compilations: id uuid pk, project_id uuid fk,
              status text (queued|running|success|error),
              log text, pdf bytea null, synctex bytea null,
              started_at, finished_at
```

- Text files store in `content`; binary assets (images, `.bib` treated as text,
  PDFs, etc.) store in `blob`.
- Retain the ~10 most recent compilations per project; prune older rows on
  insert.
- New project seeds a minimal `main.tex` article skeleton.

## API Surface

Projects:

- `GET /api/projects` — list (id, name, updated_at, last compile status)
- `POST /api/projects` — create (name, engine)
- `GET /api/projects/{id}` — project metadata + file tree
- `PATCH /api/projects/{id}` — rename, change engine, set main_file
- `DELETE /api/projects/{id}`

Files:

- `GET /api/projects/{id}/files/{path...}` — content (text) or binary stream
- `PUT /api/projects/{id}/files/{path...}` — upsert text content (save)
- `POST /api/projects/{id}/files` — create file / upload binary (multipart)
- `DELETE /api/projects/{id}/files/{path...}`

Compilation and artifacts:

- `POST /api/projects/{id}/compile` — trigger compile (manual)
- `GET /api/projects/{id}/pdf` — latest successful PDF
- `GET /api/projects/{id}/synctex` — latest `.synctex.gz`
- `GET /api/projects/{id}/log` — latest compile log
- SyncTeX forward: `GET /api/projects/{id}/synctex/forward?file&line` → page, x, y
- SyncTeX inverse: `GET /api/projects/{id}/synctex/inverse?page&x&y` → file, line

Realtime:

- `WS /api/ws/{project_id}` — status events: `queued` → `running` →
  `success` | `error`, with parsed problems on completion.

## Compile Pipeline

Trigger: the frontend debounces edits ~2s, saves the file via `PUT`, and the
backend enqueues a compile for that project. Manual compile via the button or
`Ctrl+S`. One job per project at a time (asyncio queue, serialized per project).

Worker steps:

1. Materialize all project files into `/tmp/compile/{project}/{job}`.
2. Run `latexmk -<engine> -synctex=1 -interaction=nonstopmode -halt-on-error`
   on `main_file`. Timeout 120s; kill the process on breach.
3. Parse the `.log`: error entries (`!` marker lines, `l.NNN` line numbers,
   current input file) and warnings into a structured list.
4. On success, store `pdf` and `synctex.gz` in the compilation row.
5. Push the result over WebSocket.
6. Remove the temp directory.

On failure the previously successful PDF remains served, matching Overleaf
behavior (last good preview stays visible).

## Frontend

Routes (TanStack Router):

- `/` — project grid: create, open, delete. Motion card transitions.
- `/projects/$projectId` — three resizable panes (react-resizable-panels):
  file tree | editor | PDF preview.

Components and behavior:

- File tree: shadcn styling, lucide icons, actions for create file/folder,
  rename, delete, upload.
- Editor: CodeMirror 6 with LaTeX language support, autocomplete for
  `\ref`, `\cite`, `\input` from project files and `.bib` entries, bracket
  matching, search. Theme follows app dark/light toggle.
- PDF viewer: pdfjs-dist, continuous scroll. Inverse search on ctrl+click →
  `synctex edit` → editor jumps to line and highlights. Forward search: cursor
  line → `synctex view` → PDF scrolls to and highlights the location.
- Problems panel: parsed log errors, click opens the file at the line.
- Sonner toasts for save and compile results. `Ctrl+S` = save + compile now.
- TanStack Query caches file content and compile status; invalidate on compile.
- React Compiler enabled in the Vite config.

## Error Handling

- Compile failure: red status, Problems list populated, last good PDF retained.
- WebSocket drop: poll compile status query as a fallback; reconnect resumes
  live updates.
- Missing file (deleted elsewhere): toast + refresh the tree.
- Upload cap 50MB per file.
- Path traversal: normalize `{path...}` and reject any `..` segment.

## Testing

Backend (pytest):

- Project and file CRUD.
- Path traversal guard.
- Compile log parser unit tests.
- End-to-end compile of a tiny fixture project: assert PDF bytes and a
  synctex row are produced. Uses the real `latexmk`.
- Postgres via a test container.

Frontend (vitest + Testing Library):

- Compile log parser and SyncTeX coordinate math (pure functions).
- Component smoke tests.

Manual verification:

- `docker compose up` → create project → edit → PDF renders → SyncTeX both
  directions → download PDF.

Playwright E2E is deferred for v1.
