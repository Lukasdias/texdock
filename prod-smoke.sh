#!/usr/bin/env bash
# Production smoke test: the single image must serve the SPA at / and the API.
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:8000}"

echo "== GET / (SPA shell) =="
curl -fsS "$BASE/" | grep -qi '<div id="root">'
echo "ok: SPA shell served"

echo "== GET /api/health =="
curl -fsS "$BASE/api/health"
echo
echo "ok: API served"

echo "SMOKE PASS"
