# texdock

Self-hosted, dockerized LaTeX editor. Single-user, loopback-only, no accounts.

Backend: Python 3.13, FastAPI, uv, SQLAlchemy 2 (async) over Postgres 17, and
`latexmk` with Debian TeX Live. Postgres is the single source of truth for
projects, files, and compile artifacts.

## Requirements

- Docker with the Compose plugin.
- Host port `8000` free (published loopback-only).

## Quick start (development)

```bash
cp .env.example .env
docker compose up --build
```

Then open `http://127.0.0.1:8000/api/health` — it returns `{"status":"ok"}`.

The first build installs TeX Live, so it takes several minutes and produces a
large image.

## Services

- `db` — `postgres:17-alpine`, data in the named volume `pgdata`.
- `app` — the backend image (`./backend`), serving the API on
  `127.0.0.1:8000`.

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
- `WS /api/ws/{id}` — compile status events

## Tests

Run the suite inside the app container (the `db` service is started
automatically):

```bash
docker compose run --rm app uv run pytest
```

Tests marked `latex` exercise the real `latexmk` toolchain; run a subset with
`-m "not latex"` when TeX Live is unavailable.

The suite uses a dedicated `texdock_test` database derived from
`TEST_DATABASE_URL` (created on first run). Outside Docker it defaults to
`postgresql+asyncpg://texdock:texdock@localhost:55432/texdock_test`.

## Backup

Postgres is the only stateful store, so a logical dump is a complete backup:

```bash
docker compose exec -T db pg_dump -U texdock texdock > texdock-$(date +%F).sql
```

Restore with `psql` against the same database.
