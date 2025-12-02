# AI FILE EXPLORER

**problem:** files get messy, people have trouble finding what they're looking for

**solution**: a file explorer that indexes files using "ai" (expanded below). allowing for a more holistic search over files
- "indexing" involves ripping apart files and identifying what "topic" they're about, then storing that
    - pdfs, text files -> identifying the content of pdfs (some processing might be needed)
    - images -> identifying subjects, traits, "feeling" of the image
    - BUCKET LIST ITEM: can be extended beyond just files. index web pages, chats, etc.
        - more bucket list item: index gifs, videos, larger files (is it too much processing?)
    - index is stored in a way that is easily updateable and searchable (e.g. vector store + reverse index)
- "searching" involves looking at the index and finding a bunch of files

**TECHNOLOGIES**
- HTML/CSS/JS frontend
- Python - starts a localhost:* server to serve frontend, communicates with the frontend and does the indexing and search 
    - has a lot of ML libraries
    
#### Reindex Documents
Rebuilds the semantic index from files in `documents/` folder.

```bash
curl -X GET "http://127.0.0.1:8000/api/reindex"
```

Response:
```json
{
    "indexed_chunks": 42
}
```

#### Search Files
Searches for files matching a query using semantic similarity.

```bash
curl -G "http://127.0.0.1:8000/api/search" \
  --data-urlencode "q=rhetoric" \
  --data-urlencode "k=5"
```

Parameters:
- `q` (required): Search query string
- `k` (optional): Number of results to return (default: 5, max: 50)

Response:
```json
{
    "query": "rhetoric",
    "results": [
        "documents/how-to-write-good.pdf",
        "documents/hw/essay-1.txt"
    ]
}
```

### Implementation Details

- Uses ChromaDB for vector storage (persisted in `.chroma/` directory)
- Uses `sentence-transformers` with `all-MiniLM-L6-v2` model for embeddings
- Files are chunked into 1000-character segments with 200-character overlap
- Only scans files in `documents/` folder (safety limit: 200 files max)

**GITHUB**: https://github.com/jaydenstab/FileExplorer