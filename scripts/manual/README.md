# Manual API smoke scripts

These are **developer-only** scripts that call the running Django API over HTTP. They are **not** run by CI and **not** discovered by `python manage.py test`.

## Prerequisites

- Backend: `python manage.py runserver 8000` (or equivalent)
- Python package: `requests` (`pip install requests`)
- Indexed corpora under the document roots you pass in each script (defaults often use `documents1` / `documents2`)

## Scripts

| File | Purpose |
| --- | --- |
| [`test_reranker.py`](test_reranker.py) | Search with/without reranker; checks `rerank_score` and ordering |
| [`test_confidence.py`](test_confidence.py) | Query confidence fields and distance / rerank sanity |
| [`test_simple.py`](test_simple.py) | Background reindex progress polling + distance threshold sample |

Run from repository root, for example:

```bash
python scripts/manual/test_reranker.py
```
