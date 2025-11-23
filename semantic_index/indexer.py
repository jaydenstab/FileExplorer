"""
Semantic indexing module - handles reading files, chunking text, creating embeddings,
and storing them in ChromaDB for semantic search.
"""
from pathlib import Path
import chromadb
import fitz  # PyMuPDF
from typing import List
from functools import lru_cache
from sentence_transformers import SentenceTransformer

# Configuration constants
BASE_DIR = Path(__file__).resolve().parents[1]
CHROMA_DIR = BASE_DIR / ".chroma"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"  # sentence-transformers model for creating embeddings
MAX_FILES = 200  # Safety limit to prevent accidentally indexing too many files
CHUNK_SIZE = 1000  # Characters per chunk
CHUNK_OVERLAP = 200  # Overlap between chunks to preserve context
SUPPORTED_EXTS = {".pdf", ".txt"}


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    """Load and cache the embedding model (only loads once, reused for all operations)."""
    return SentenceTransformer(EMBEDDING_MODEL)


def _read_text_file(path: str) -> str:
    """Read text from a .txt file."""
    p = Path(path)
    with p.open("r", encoding="utf-8", errors="ignore") as f:
        return f.read()


def _read_pdf_text(path: str) -> str:
    """Extract all text from a PDF file using PyMuPDF."""
    text = ""
    with fitz.open(path) as pdf:
        for page in pdf:
            text += page.get_text()
    return text


def _extract_text(path: str) -> str:
    """Extract text from a file based on its extension (.pdf or .txt)."""
    suffix = Path(path).suffix.lower()
    if suffix == ".txt":
        return _read_text_file(path)
    if suffix == ".pdf":
        return _read_pdf_text(path)
    return ""


def _chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """
    Split text into overlapping chunks.
    This allows us to search within large documents and preserve context at boundaries.
    """
    text = text or ""
    n = len(text)
    if n == 0:
        return []
    chunks = []
    start = 0
    while start < n:
        end = min(start + size, n)
        chunks.append(text[start:end])
        if end == n:
            break
        # Move start forward, but overlap with previous chunk
        start = max(0, end - overlap)
    return chunks


def _list_files(documents_dir: Path) -> List[Path]:
    """Find all PDF and text files in the specified documents folder."""
    documents_dir.mkdir(parents=True, exist_ok=True)
    files: List[Path] = []
    for ext in SUPPORTED_EXTS:
        files.extend(sorted(documents_dir.rglob(f"*{ext}")))
    return files[:MAX_FILES]


def _relative_path(p: Path) -> str:
    """Convert absolute path to relative path from project root (e.g., 'documents/file.pdf')."""
    return str(p.resolve().relative_to(BASE_DIR.resolve()))


def index_documents(directory: str = "documents1") -> int:
    """
    Main indexing function: scans documents folder, extracts text, chunks it,
    creates embeddings, and stores everything in ChromaDB.
    
    Args:
        directory: Name of the directory to index (relative to project root, e.g., "documents1", "documents2")
    
    Returns:
        The number of chunks indexed.
    """
    # Resolve the documents directory path
    documents_dir = BASE_DIR / directory
    
    # Set up ChromaDB persistent storage
    CHROMA_DIR.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    
    # Use directory name in collection name to keep different directories separate
    collection_name = f"files_{directory}"
    
    # Delete existing collection to rebuild from scratch (avoids stale data)
    try:
        client.delete_collection(collection_name)
    except Exception:
        pass
    collection = client.get_or_create_collection(name=collection_name)

    # Find all files to index
    files = _list_files(documents_dir)
    model = _get_model()

    # Prepare data for ChromaDB
    docs: List[str] = []  # Text chunks
    ids: List[str] = []   # Unique IDs for each chunk
    metas: List[dict] = []  # Metadata (file path, chunk number)

    # Process each file
    for f in files:
        text = _extract_text(str(f))
        if not text.strip():
            continue
        
        # Get relative path for the response
        rel = _relative_path(f)
        
        # Split file into chunks and add each chunk to the database
        for i, chunk in enumerate(_chunk_text(text)):
            docs.append(chunk)
            ids.append(f"{rel}::chunk-{i}")
            metas.append({"path": rel, "chunk": i})

    if not docs:
        return 0

    # Create embeddings for all chunks at once (more efficient)
    embeddings = model.encode(docs).tolist()
    
    # Store everything in ChromaDB
    collection.add(documents=docs, embeddings=embeddings, metadatas=metas, ids=ids)
    return len(ids)


# Export model getter for search module
get_model = _get_model
