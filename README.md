# AI File Explorer

A semantic file search application that uses AI-powered indexing to help you find files based on their content, not just their names.

## Problem

Files get messy, and people have trouble finding what they're looking for. Traditional file explorers only search by filename, which isn't enough when you need to find content.

## Solution

A file explorer that indexes files using semantic AI embeddings, allowing for holistic content-based search over your files:
- **Indexing**: Extracts and analyzes file content to identify topics and themes
  - PDFs and text files: Extracts and processes content
  - Images: Identifies subjects, traits, and visual elements (planned)
  - Index stored in a vector database for fast semantic search
- **Searching**: Finds files based on meaning and context, not just keywords

## Tech Stack

### Frontend
- **React 19** with **TypeScript**
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **Lucide React** for icons

### Backend
- **Django 5.2** REST API
- **ChromaDB** for vector storage
- **sentence-transformers** for embeddings (`all-MiniLM-L6-v2` model)
- **PyMuPDF** for PDF parsing
- **python-dotenv** for environment variable management

## Setup

### Prerequisites
- Python 3.8+
- Node.js 18+
- npm or yarn

### Backend Setup

1. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Set up environment variables:
   Create a `.env` file in the project root with your Django secret key:
   ```bash
   # Generate a secret key (optional, for production)
   python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
   
   # Create .env file
   echo "DJANGO_SECRET_KEY=your-secret-key-here" > .env
   ```
   
   Note: The `.env` file is already in `.gitignore` and won't be committed. For development, you can use the default fallback key, but for production, always set a secure `DJANGO_SECRET_KEY`.

4. Run database migrations:
   ```bash
   python manage.py migrate
   ```

5. Start the Django server:
   ```bash
   python manage.py runserver
   ```

The API will be available at `http://127.0.0.1:8000`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

The frontend will be available at `http://localhost:5173`

## Usage

1. **Add files**: Place PDF or text files in the `documents/` folder
2. **Index files**: Click the "Reindex" button in the UI or call the reindex API endpoint
3. **Search**: Type your query in the search bar to find files by semantic similarity

## API Endpoints

### Reindex Documents
Rebuilds the semantic index from all files in the `documents/` folder.

```bash
GET http://127.0.0.1:8000/api/reindex
```

Response:
```json
{
    "indexed_chunks": 42
}
```

### Search Files
Searches for files matching a query using semantic similarity.

```bash
GET http://127.0.0.1:8000/api/search?q=rhetoric&k=5
```

Parameters:
- `q` (required): Search query string
- `k` (optional): Number of results to return (default: 5, max: 50)

Response:
```json
{
    "query": "rhetoric",
    "results": [
        "documents/Cultural Contexts for Argument.pdf",
        "documents/test-rhetoric.txt"
    ]
}
```

## Implementation Details

- **Vector Storage**: ChromaDB (persisted in `.chroma/` directory)
- **Embeddings**: `sentence-transformers` with `all-MiniLM-L6-v2` model
- **Chunking**: Files are split into 1000-character segments with 200-character overlap
- **File Limits**: Only scans files in `documents/` folder (safety limit: 200 files max)
- **Search**: Debounced search with 600ms delay for better performance


## Weekly Tasks

### pagination

form to specify what files/folders to index
button to start an index
progress bar to show index progress

### thoughts
backend: index websites too?


## Future Goals

- [ ] Image classification and indexing
- [ ] Support for more file types (videos, GIFs)
- [ ] Web page indexing
- [ ] Chat/conversation indexing
- [ ] Advanced filtering and sorting options
