"""
Semantic indexing module - handles reading files, chunking text, creating embeddings,
and storing them in ChromaDB for semantic search.
"""
from pathlib import Path
import os
import chromadb
import fitz  # PyMuPDF
import time  # Added: for time.sleep() to add artificial delay (slow mode for testing)
from typing import List, Optional, Callable  # Added: Optional and Callable for progress callback
from functools import lru_cache
from sentence_transformers import SentenceTransformer

# Configuration constants
BASE_DIR = Path(__file__).resolve().parents[1]
CHROMA_DIR = BASE_DIR / ".chroma"

# Default sentence-transformers model for creating embeddings.
# We use a stronger retrieval model than all-MiniLM to improve initial recall
# before reranking. Can be overridden via the SEMANTIC_EMBEDDING_MODEL env var.
DEFAULT_EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
EMBEDDING_MODEL = os.getenv("SEMANTIC_EMBEDDING_MODEL", DEFAULT_EMBEDDING_MODEL)
MAX_FILES = 200  # Safety limit to prevent accidentally indexing too many files
CHUNK_SIZE = 1000  # Characters per chunk
CHUNK_OVERLAP = 200  # Overlap between chunks to preserve context
SUPPORTED_EXTS = {".pdf", ".txt"}
# want to chunk because it's easier to search for chunks than the entire file
# overlap to preserve context at boundaries

@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    """
    Load and cache the embedding model (only loads once, reused for all operations).
    
    The model name comes from the EMBEDDING_MODEL constant, which can be
    overridden at runtime via the SEMANTIC_EMBEDDING_MODEL environment variable.
    """
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


def index_documents(
    directory: str = "documents1",
    progress_callback: Optional[Callable[[int, int, Optional[str], str], None]] = None,
    slow_ms: int = 0
) -> int:
    """
    Main indexing function: scans documents folder, extracts text, chunks it,
    creates embeddings, and stores everything in ChromaDB.
    
    Args:
        directory: Name of the directory to index (relative to project root, e.g., "documents1", "documents2")
        progress_callback: Optional callback(current, total, current_file, phase) called during indexing
        slow_ms: Optional artificial delay in milliseconds per file (for testing progress bar)
    
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
    
    # Delete existing collection to rebuild from scratch (removes all old files)
    # This ensures only files currently in the directory are indexed
    try:
        client.delete_collection(collection_name)
    except Exception:
        # Collection doesn't exist yet, which is fine
        pass
    
    # Create a fresh collection (empty, ready for new data)
    collection = client.get_or_create_collection(name=collection_name)
    
    # Clear any existing data in the collection (in case deletion didn't work)
    # This is a safety measure to ensure we start with a clean slate
    try:
        # Get all existing IDs and delete them
        existing_data = collection.get()
        if existing_data and existing_data.get("ids"):
            collection.delete(ids=existing_data["ids"])
    except Exception:
        # Collection is empty or doesn't have data, which is fine
        pass

    # Find all files to index
    files = _list_files(documents_dir)
    total_files = len(files)  # Track total for progress percentage calculation
    
    # Report initial progress (0% - just starting)
    # progress_callback(current, total, current_file, phase)
    if progress_callback:
        progress_callback(0, total_files, None, "starting")
    
    model = _get_model()

    # Prepare data for ChromaDB
    docs: List[str] = []  # Text chunks
    ids: List[str] = []   # Unique IDs for each chunk
    metas: List[dict] = []  # Metadata (file path, chunk number)

    # Process each file
    # enumerate(files, start=1) gives us: (1, file1), (2, file2), etc.
    for file_idx, f in enumerate(files, start=1):
        # Report progress: "Currently processing file X out of Y"
        rel = _relative_path(f)  # e.g., "documents1/file.pdf"
        if progress_callback:
            # Call the callback: current=file_idx (e.g., 3), total=total_files (e.g., 12)
            # This updates the progress store so frontend can poll and see 25% complete
            progress_callback(file_idx, total_files, rel, "reading")
        
        # ARTIFICIAL DELAY: For testing the progress bar visually
        # If slow_ms=250, wait 0.25 seconds per file so you can see the bar move
        # In production, this would be 0 (no delay)
        if slow_ms > 0:
            time.sleep(slow_ms / 1000.0)  # Convert milliseconds to seconds
        
        text = _extract_text(str(f))
        if not text.strip():
            continue
        
        # Split file into chunks and add each chunk to the database
        for i, chunk in enumerate(_chunk_text(text)):
            docs.append(chunk)
            ids.append(f"{rel}::chunk-{i}")
            metas.append({"path": rel, "chunk": i})

    if not docs:
        if progress_callback:
            progress_callback(total_files, total_files, None, "completed")
        return 0

    # Create embeddings for all chunks at once (more efficient)
    # Report phase change: we're now embedding, not reading files
    if progress_callback:
        progress_callback(total_files, total_files, None, "embedding")
    # For models like BGE, it is recommended to normalize embeddings for
    # cosine-similarity-based retrieval. This generally makes distances
    # more comparable and improves retrieval quality.
    embeddings = model.encode(docs, normalize_embeddings=True).tolist()
    
    # Store everything in ChromaDB
    # Report phase change: we're now storing in database
    if progress_callback:
        progress_callback(total_files, total_files, None, "storing")
    collection.add(documents=docs, embeddings=embeddings, metadatas=metas, ids=ids)
    
    # Final progress update: 100% complete
    if progress_callback:
        progress_callback(total_files, total_files, None, "completed")
    
    return len(ids)


# Export model getter for search module
get_model = _get_model
