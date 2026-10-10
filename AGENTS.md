# AGENTS.md

Project instructions for agents working in the `texdock` repository.

## What this is

A single-user, loopback-only, dockerized LaTeX editor (a lightweight,
self-hosted alternative to Overleaf CE). See `README.md` for scope and the
feature matrix. Keep it simple; it is for personal use, not public deployment.

## Layout

```
backend/            FastAPI + uv + SQLAlchemy 2 (async) + latexmk/TeX Live
  app/
    main.py         app factory; mounts API routers, WS, and the built SPA
    config.py       pydantic-settings (DB-free)
    db.py           engine, session factory, Base, init_db (create_all)
    models.py       Project, File, Compilation
    schemas.py      pydantic request/response models
    paths.py        normalize_project_path + InvalidPathError (traversal guard)
    latex/
      compiler.py   materialize + run latexmk under a process-group timeout
      logparser.py  parse .log -> list[Problem]
      synctex.py    forward/inverse via the `synctex` CLI
    jobs.py         per-project compile queue (single worker, FIFO)
    ws.py           WebSocket connection manager
    routers/        projects.py, files.py, compile.py
  tests/            pytest (see markers below)
frontend/           React 19 + Vite 8 + TanStack Router/Query + CodeMirror 6
  src/
    routes/         file-based routes (index = project grid, projects.$projectId)
    components/     FileTree, LatexEditor, PdfViewer, ProblemsPanel, CompileToolbar
    lib/            api.ts, queries.ts, ws.ts, logparser.ts, synctex.ts
    hooks/          useAutosave.ts
Dockerfile          multi-stage: Bun builds SPA -> Python + TeX Live runtime
docker-compose.yml  db (postgres:17-alpine) + app (prod image) + backend-dev (profile dev)
prod-smoke.sh       curl checks: SPA shell + API on the running stack
docs/superpowers/   the design spec and implementation plan
```

## Commands

Backend (run from `backend/`):

```bash
uv run pytest                       # full suite
uv run pytest -m latex              # real latexmk tests (needs TeX Live)
uv run pytest -m "not latex"        # skip toolchain-dependent tests
uv run uvicorn app.main:create_app --factory --reload --port 8000
uv run ruff check app tests
```

Frontend (run from `frontend/`):

```bash
bun install
bun run vitest run                  # unit tests
bun run build                       # tsc -b && vite build
bun run dev                         # dev server (no /api proxy configured)
```

Docker:

```bash
docker compose up --build           # prod: db + single app image on 127.0.0.1:8000
docker compose --profile dev run --rm backend-dev uv run pytest
bash prod-smoke.sh                  # after the stack is up
```

## Testing notes

- Backend tests use a real Postgres test database, default
  `postgresql+asyncpg://texdock:texdock@localhost:55432/texdock_test`
  (override with `TEST_DATABASE_URL`). Host port 5432 is commonly occupied;
  55432 avoids clashes. The schema is dropped/recreated per session.
- Tests marked `latex` shell out to the real `latexmk`; run them on a host or
  image with TeX Live.
- Follow TDD: write the failing test first, watch it fail, implement the
  minimum, watch it pass, then commit.

## Conventions

- Python 3.13, `uv` for dependencies. Async FastAPI + SQLAlchemy 2.0 style
  (`Mapped[...]`, async sessions). No blocking I/O in request handlers.
- Frontend: TypeScript, no `any`. TanStack Query for server state. Tailwind v4
  via `@tailwindcss/vite` (no `tailwind.config.ts`; theme lives in
  `src/styles.css` using the four-step `@theme inline` pattern). React Compiler
  is enabled through `vite-plugin-babel`.
- Commit messages: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
- Documentation: factual and technical only. No marketing language, hype words,
  or emoji.

## Invariants (do not break)

- Postgres is the single source of truth; the only named volume is `pgdata`.
- Every user-supplied file path goes through `normalize_project_path`; reject
  absolute, empty, and `..`-containing paths. The SPA fallback in `main.py`
  reuses this guard plus a resolved-path containment check — never serve a file
  outside the static directory.
- Compile timeout kills the whole process group (`os.killpg`), not just the
  parent, so forking engines cannot orphan.
- Bind to `127.0.0.1` only. No auth exists; the app must not be exposed.
- Retain the 10 most recent compilations per project; prune on insert.
- Upload cap is 50 MB per file.

## Gotchas

- `codemirror-lang-latex`'s `latex()` installs its own
  `autocompletion({ override })`. Adding a second `autocompletion()` throws
  "Config merge conflict for field override". The editor calls
  `latex({ enableAutocomplete: false, autoCloseBrackets: false })` and owns a
  single `autocompletion()` plus `completionKeymap`.
- SyncTeX coordinates are top-left origin in points; the frontend transform is
  a pure scale (`x/scale`, `y/scale`), not a Y-flip.
- `xelatex` requires the `texlive-xetex` package; it is installed in both images.
- `fontawesome5` and other CTAN font packages require `texlive-fonts-extra`
  (a large package); it is installed in both images.
- `.dockerignore` excludes `.worktrees/`, `docs/`, `dist`, `node_modules`, and
  `.venv` to keep the build context small.
- `docker compose` may need `DOCKER_CONFIG` pointed at an empty dir on hosts
  whose Docker config references a missing credential helper.
