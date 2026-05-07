# AI FILE EXPLORER

**problem:** files get messy, people have trouble finding what they're looking for

**solution:** a file explorer that indexes files using "ai" (expanded below). allowing for a more holistic search over files

## What It Does

- Indexes supported files into a vector database for semantic search
- Searches across one or more document directories
- Returns either plain file paths or scored results
- Supports reranking for better final result quality
- Exposes query-level and per-result relevance information
- Supports background reindexing with progress polling

## Tech Stack

- Frontend: React + TypeScript + Vite
- Backend: Django
- Vector store: ChromaDB
- Embeddings: `sentence-transformers` using `BAAI/bge-small-en-v1.5`
- Reranker: `FlagEmbedding` using `BAAI/bge-reranker-v2-m3`

## Supported Files

- `.pdf`
- `.txt`

Files are indexed from directories relative to the project root, such as `documents1` and `documents2`.

## Setup

### Backend

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py runserver 8000
```

Backend runs at `http://127.0.0.1:8000/`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173/`.

## Reindex API

There are two reindex flows:

- Synchronous legacy endpoint: `GET /api/reindex`
- Background job endpoint with progress tracking: `POST /api/reindex/start`

### Reindex a Directory

```bash
curl "http://127.0.0.1:8000/api/reindex?dir=documents1"
```

Example response:

```json
{
  "indexed_chunks": 42,
  "directory": "documents1"
}
```

### Start Background Reindex

```bash
curl -X POST "http://127.0.0.1:8000/api/reindex/start?dir=documents1"
```

Example response:

```json
{
  "job_id": "6612501c-9b41-4f8d-8fce-f3c99d9de0fb"
}
```

### Poll Reindex Status

```bash
curl "http://127.0.0.1:8000/api/reindex/status?job_id=6612501c-9b41-4f8d-8fce-f3c99d9de0fb"
```

Example response:

```json
{
  "job_id": "6612501c-9b41-4f8d-8fce-f3c99d9de0fb",
  "status": "indexing",
  "directory": "documents1",
  "current": 3,
  "total": 12,
  "percent": 25.0,
  "current_file": "documents1/file.pdf",
  "phase": "reading",
  "updated_at": "2026-03-07T03:05:09",
  "error": null
}
```

## Search API

Search endpoint:

```text
GET /api/search
```

### Basic Search

```bash
curl -G "http://127.0.0.1:8000/api/search" \
  --data-urlencode "q=rhetoric" \
  --data-urlencode "dir=documents1" \
  --data-urlencode "k=5"
```

Example response without scores:

```json
{
  "query": "rhetoric",
  "directories": ["documents1"],
  "results": [
    "documents1/test-rhetoric.txt",
    "documents1/topic_pdf_12.pdf"
  ],
  "query_confidence_score": 0.9989,
  "query_confidence_level": "high"
}
```

### Search with Scores, Reranking, and Filters

```bash
curl -G "http://127.0.0.1:8000/api/search" \
  --data-urlencode "q=neural networks" \
  --data-urlencode "dirs=documents1,documents2" \
  --data-urlencode "page=1" \
  --data-urlencode "page_size=5" \
  --data-urlencode "include_scores=true" \
  --data-urlencode "use_reranker=true" \
  --data-urlencode "min_confidence=medium" \
  --data-urlencode "distance_threshold=1.0" \
  --data-urlencode "file_types=pdf,txt"
```

Example response with scores:

```json
{
  "query": "neural networks",
  "directories": ["documents1", "documents2"],
  "page": 1,
  "page_size": 5,
  "has_next": false,
  "results": [
    {
      "path": "documents1/test-neural-networks.txt",
      "distance": 0.3011,
      "rerank_score": 0.9991
    }
  ],
  "query_confidence_score": 0.9991,
  "query_confidence_level": "high"
}
```

### Search Parameters

- `q` required: Search query string
- `k` optional: Number of results to return when pagination is not used, default `5`, max `50`
- `page` optional: Page number for pagination, default `1`
- `page_size` optional: Results per page, default `5`, max `50`
- `dir` optional: Single directory to search, default `documents1`
- `dirs` optional: Comma-separated directories to search, overrides `dir`
- `include_scores` optional: If `true`, returns result objects instead of plain paths
- `use_reranker` optional: If `true`, reranks results and enables relevance filtering, default `true`
- `min_confidence` optional: `low`, `medium`, or `high`; uses reranker score thresholds
- `distance_threshold` optional: Maximum embedding distance, lower is better, valid range `0-2`
- `file_types` optional: Comma-separated extensions such as `pdf,txt`

## Relevance vs Distance

The app exposes two different quality signals:

- `distance`: embedding-space distance from the initial vector search, lower is better
- `rerank_score`: reranker relevance score in the `0-1` range, higher is better

`Min relevance` filters on `rerank_score`, while `Max distance` filters on embedding distance. Both are useful because they measure different parts of the retrieval pipeline.

## Implementation Details

- ChromaDB data is persisted in `.chroma/`
- Files are chunked into 1000-character segments with 200-character overlap
- Supported extensions are `.pdf` and `.txt`
- Embeddings are normalized before storage/querying
- Each directory gets its own Chroma collection, e.g. `files_documents1`
- Reindexing rebuilds the collection for the target directory from scratch
- Large files are skipped using a configurable max file size
- The indexer has a safety limit of 200 files per directory

## CI and local verification

GitHub Actions runs three jobs: **backend** (`python manage.py test explorer`), **frontend** (`npm run verify:repo` in `frontend/`), and **e2e** (Playwright against Django + Vite preview). The backend job is intentionally scoped to the `explorer` app so CI does not pick up ad-hoc root-level test scripts that expect a live server.

To mirror CI locally:

```bash
pip install -r requirements.txt
python manage.py test explorer
cd frontend && npm ci && npm run verify:repo
```

For the full Playwright flow, start Django and `vite preview`, then from `frontend/` run `CI_E2E=1 npx playwright test` (see `.github/workflows/ci.yml` for URLs and ports).

## Environment tunables

| Variable | Purpose | Notes |
| --- | --- | --- |
| `CHROMA_MAX_N_RESULTS` | Max rows returned per Chroma query per collection | Integer ≥ 1; default 50 |
| `PLAINTEXT_SEARCH_MAX_BYTES_PER_FILE` | Bytes read per `.txt` during substring search | Default 2 MiB; minimum 4096 |
| `PLAINTEXT_SEARCH_MAX_PDF_PAGES` | PDF pages scanned per file for substring search | Integer ≥ 1; default 10 |
| `PLAINTEXT_SEARCH_MAX_WORKERS` | Thread pool size for parallel plaintext scans | Integer ≥ 1; default 4 |
| `API_FILE_MAX_AGE_SECONDS` | `Cache-Control: max-age` for `/api/file` PDF responses | Default 120 |
| `SEMANTIC_EMBEDDING_MODEL` | Sentence-transformers model id for embeddings | See `semantic_index/indexer.py` |
| `SEMANTIC_MAX_FILE_SIZE_BYTES` | Skip indexing files larger than this | Default in indexer |

Chroma’s Python client is cached once per process with a lock around first construction; for development, `runserver` is single-threaded by default. For production, prefer a clear worker model (e.g. one worker process per container) if you rely on a single shared Chroma directory.
