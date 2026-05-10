# AI File Explorer — contributor context

Use the repository **[README.md](../README.md)** for product overview, API examples (search, reindex, rename), CI, and environment variables. Use **[docs/REFACTOR_NOTES.md](../docs/REFACTOR_NOTES.md)** for frontend conventions (React Query, explorer hooks, controller composition).

## Stack

- **Backend:** Django 5.x, SQLite by default, app package [`explorer/`](../explorer/) (views, URL includes, models including `ExplorerSettings` for persisted document root names).
- **Indexing / search:** [`semantic_index/`](../semantic_index/) (ChromaDB under project `.chroma/`, embeddings, plaintext + semantic search).
- **Frontend:** [`frontend/`](../frontend/) — Vite + React + TypeScript; explorer UI under `frontend/src/components/explorer/`.

## URLs

- Root site: `backend/urls.py` maps `''` to explorer home and mounts **`path('api/', include('explorer.urls'))`** for JSON APIs.
- API route definitions: [`explorer/urls.py`](../explorer/urls.py).

## Path policy and document roots

Allowed paths for open/file/search/reindex combine persisted document root directory names (`get_document_root_dirs()` in [`explorer/document_roots.py`](../explorer/document_roots.py)) plus the library root. Do not reintroduce a hardcoded-only allow list without updating the DB-backed settings and migrations.

## Tests

- Primary Django tests: [`explorer/tests.py`](../explorer/tests.py) — run `python manage.py test explorer` (matches CI scope).
- Frontend: `cd frontend && npm run verify:repo`; E2E: see root README and [`frontend/e2e/`](../frontend/e2e/).
- Optional HTTP smoke scripts (live server + `requests`): [`scripts/manual/`](../scripts/manual/).

## Experiments

Optional scripts under [`experiments/`](../experiments/) (e.g. [`experiments/pdfparse.py`](../experiments/pdfparse.py)) are not the main indexing path; production indexing flows through `semantic_index` and explorer APIs.

## Security

Read **[SECURITY.md](../SECURITY.md)** for CSRF-exempt endpoints, threat model, and path validation expectations before changing auth or exposing the server.
