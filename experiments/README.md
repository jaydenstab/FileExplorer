# Experiments

Standalone scripts and prototypes in this directory are **not** on the production indexing path. The app’s real pipeline is `semantic_index/` plus the `explorer` HTTP APIs (`/api/search`, `/api/reindex`, etc.).

Use these files for one-off exploration (PDF parsing helpers, CLIP sketches, etc.). If something graduates to production behavior, move the implementation into `explorer/` or `semantic_index/` and add tests under `explorer/tests.py` (or Vitest for frontend-only logic).
