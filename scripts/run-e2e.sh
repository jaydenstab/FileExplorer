#!/usr/bin/env bash
# Full-stack Playwright e2e — same flow as .github/workflows/ci.yml (e2e job).
# Run from repository root. Uses ports 8000 (Django) and 5173 (Vite preview).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

python3 -m pip install -r requirements.txt

python3 - <<'PY'
from pathlib import Path
import fitz

Path("documents1").mkdir(parents=True, exist_ok=True)
doc = fitz.open()
doc.new_page().insert_text((72, 72), "e2e_page1")
doc.new_page().insert_text((72, 72), "e2e_page2_unique_scroll")
doc.save("documents1/e2e_two_page.pdf")
doc.close()
PY

(cd frontend && npm ci)
(cd frontend && npm run build)

if [[ "$(uname -s)" == "Linux" ]]; then
  (cd frontend && npx playwright install chromium --with-deps)
else
  (cd frontend && npx playwright install chromium)
fi

cleanup() {
  if [[ -n "${VP_PID:-}" ]]; then kill "$VP_PID" 2>/dev/null || true; wait "$VP_PID" 2>/dev/null || true; fi
  if [[ -n "${DJ_PID:-}" ]]; then kill "$DJ_PID" 2>/dev/null || true; wait "$DJ_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT

require_port_free() {
  local port=$1
  if python3 -c "import socket; s=socket.socket(); s.settimeout(0.3); r=s.connect_ex(('127.0.0.1', int('$port'))); s.close(); raise SystemExit(0 if r == 0 else 1)"; then
    echo "Port ${port} is already in use (127.0.0.1). Stop the other process (runserver, vite preview, or another app) and retry." >&2
    exit 1
  fi
}

require_port_free 8000
require_port_free 5173

python3 manage.py runserver 0.0.0.0:8000 &
DJ_PID=$!
(cd frontend && npx vite preview --host 127.0.0.1 --port 5173 --strictPort) &
VP_PID=$!

wait_http() {
  local url=$1
  local label=$2
  local i=0
  while [[ "$i" -lt 60 ]]; do
    if curl -fsS --max-time 2 "$url" >/dev/null 2>&1; then
      echo "$label ready"
      return 0
    fi
    i=$((i + 1))
    sleep 1
  done
  echo "timeout waiting for $label ($url)" >&2
  return 1
}

wait_http "http://127.0.0.1:8000/" "Django"
wait_http "http://127.0.0.1:5173/" "Vite preview"

(cd frontend && CI_E2E=1 E2E_BASE_URL=http://127.0.0.1:5173 npx playwright test)
