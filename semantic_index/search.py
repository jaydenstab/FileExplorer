"""
Semantic search module - queries the vector database to find files matching a search query.
"""
from typing import List
import chromadb
from .indexer import CHROMA_DIR, get_model


def _dedupe_preserve_order(items: List[str]) -> List[str]:
    """Remove duplicates from a list while preserving the original order."""
    seen = set()
    out = []
    for x in items:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


def search_files(query: str, k: int = 5, directory: str = "documents1") -> List[str]:
    """
    Search for files matching a query using semantic similarity.
    
    Args:
        query: Search query string (e.g., "rhetoric", "neural networks")
        k: Number of results to return (default: 5)
        directory: Name of the directory to search in (e.g., "documents1", "documents2")
    
    Returns:
        List of file paths (relative to project root) that match the query,
        ordered by relevance. Duplicates are removed.
    """
    # Connect to ChromaDB
    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    collection_name = f"files_{directory}"
    
    # Check if collection exists, return empty list if it doesn't
    try:
        collection = client.get_collection(name=collection_name)
    except Exception:
        return []
    
    if not query or k <= 0:
        return []
    
    # Convert query to embedding vector
    model = get_model()
    q_emb = model.encode([query]).tolist()
    
    # Query the vector database for similar chunks
    res = collection.query(query_embeddings=q_emb, n_results=k)
    
    # Extract file paths from metadata
    metas = (res.get("metadatas") or [[]])[0]
    paths = [m.get("path") for m in metas if isinstance(m, dict) and m.get("path")]
    
    # Remove duplicate file paths (same file might have multiple matching chunks)
    return _dedupe_preserve_order(paths)
