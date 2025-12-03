"""
Semantic search module - queries the vector database to find files matching a search query.
"""
from typing import List, Dict, Optional
import chromadb
from .indexer import CHROMA_DIR, get_model


def _dedupe_preserve_order(items: List[str]) -> List[str]: # Not used
    """Remove duplicates from a list while preserving the original order."""
    seen = set()
    out = []
    for x in items:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


def aggregate_best_distance(metadatas: List[dict], distances: List[float]) -> List[Dict[str, float]]:
    """
    Aggregate chunks by file path, keeping the best (lowest) distance for each file.
    
    WHY THIS EXISTS:
    - ChromaDB returns results by CHUNK (pieces of files), not by FILE
    - One file might have multiple matching chunks (e.g., "file.pdf::chunk-0", "file.pdf::chunk-5")
    - We want to show each file only ONCE in results, with its BEST (lowest) distance
    
    Example:
    - Input: chunks from "file1.pdf" (distance 0.2) and "file1.pdf" (distance 0.5)
    - Output: {"path": "file1.pdf", "distance": 0.2}  (kept the better match)
    
    Args:
        metadatas: List of metadata dicts from ChromaDB query (contains "path" for each chunk)
        distances: List of distance values (lower = better match, e.g., 0.2 is better than 0.8)
    
    Returns:
        List of dicts with 'path' and 'distance', sorted by distance (best matches first)
    """
    # Track best (lowest) distance per file path
    # Key: file path (e.g., "documents1/file.pdf")
    # Value: best distance found for that file
    best_distances: Dict[str, float] = {}
    
    # Loop through each chunk result
    for meta, dist in zip(metadatas, distances):
        if not isinstance(meta, dict):
            continue
        path = meta.get("path")  # e.g., "documents1/file.pdf"
        if not path:
            continue
        
        # Keep the LOWEST distance (best match) for each file
        # If we've seen this file before with a worse distance, replace it
        # If we haven't seen it, add it
        if path not in best_distances or dist < best_distances[path]:
            best_distances[path] = dist
    
    # Convert dictionary to list of dicts: [{"path": "...", "distance": 0.2}, ...]
    result = [{"path": path, "distance": dist} for path, dist in best_distances.items()]
    
    # Sort by distance (lowest first = best matches first)
    result.sort(key=lambda x: x["distance"])
    
    return result


def search_files(
    query: str,
    k: int = 5,
    directory: str | List[str] = "documents1",
    include_distances: bool = False
) -> List:
    """
    Search for files matching a query using semantic similarity.
    
    Args:
        query: Search query string (e.g., "rhetoric", "neural networks")
        k: Number of results to return (default: 5)
        directory: Name of the directory to search in (e.g., "documents1", "documents2")
                   OR a list of directory names to search across multiple directories
        include_distances: If True, return list of dicts with 'path' and 'distance'. 
                          If False, return list of paths (backward compatible)
    
    Returns:
        If include_distances=False: List of file paths (relative to project root)
        If include_distances=True: List of dicts with 'path' and 'distance', sorted by distance
        Duplicates are removed. Lower distance = better match.
        When multiple directories are searched, results are merged and sorted by distance.
    """
    # Normalize directory to a list
    directories = directory if isinstance(directory, list) else [directory]
    
    if not query or k <= 0:
        return []
    
    # Connect to ChromaDB
    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    
    # Convert query to embedding vector (do this once, reuse for all directories)
    model = get_model()
    q_emb = model.encode([query]).tolist()
    
    # Collect results from all directories
    all_metas = []
    all_distances = []
    
    for dir_name in directories:
        collection_name = f"files_{dir_name}"
        
        # Check if collection exists, skip if it doesn't
        try:
            collection = client.get_collection(name=collection_name)
        except Exception:
            continue
        
        # Query the vector database for similar chunks
        # We fetch k results per directory, then merge and sort
        res = collection.query(query_embeddings=q_emb, n_results=k, include=["metadatas", "distances"])
        
        # Extract metadata and distances
        metas = (res.get("metadatas") or [[]])[0]
        distances = (res.get("distances") or [[]])[0]
        
        if metas and distances:
            all_metas.extend(metas)
            all_distances.extend(distances)
    
    if not all_metas or not all_distances:
        return []
    
    # Aggregate: convert chunk-level results to file-level results
    # Multiple chunks from same file → one entry with best (lowest) distance
    aggregated = aggregate_best_distance(all_metas, all_distances)
    
    # Limit to k results (already sorted by distance, best matches first)
    aggregated = aggregated[:k]
    
    if include_distances:
        # Return list of dicts: [{"path": "file.pdf", "distance": 0.2}, ...]
        return aggregated
    else:
        # Return just paths for backward compatibility: ["file.pdf", "file2.pdf", ...]
        return [item["path"] for item in aggregated]
