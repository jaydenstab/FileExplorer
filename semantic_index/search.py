"""
Semantic search module - queries the vector database to find files matching a search query.
"""
from typing import List, Dict, Optional, Tuple
import chromadb
from .indexer import CHROMA_DIR, get_model
from .reranker import rerank_files


def _dedupe_preserve_order(items: List[str]) -> List[str]: # Not used
    """Remove duplicates from a list while preserving the original order."""
    seen = set()
    out = []
    for x in items:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


def aggregate_best_chunk(
    metadatas: List[dict],
    distances: List[float],
    documents: List[str]
) -> Tuple[List[Dict[str, float]], Dict[str, str]]:
    """
    Aggregate chunks by file path, keeping the best (lowest) distance for each file.
    Also tracks the best matching chunk text for each file (needed for reranking).
    
    Args:
        metadatas: List of metadata dicts from ChromaDB query (contains "path" for each chunk)
        distances: List of distance values (lower = better match)
        documents: List of document text chunks from ChromaDB
    
    Returns:
        Tuple of:
        - List of dicts with 'path' and 'distance', sorted by distance
        - Dict mapping file paths to their best matching chunk text
    """
    best_distances: Dict[str, float] = {}
    best_chunks: Dict[str, str] = {}
    
    for meta, dist, doc in zip(metadatas, distances, documents):
        if not isinstance(meta, dict):
            continue
        path = meta.get("path")
        if not path:
            continue
        
        # Keep the LOWEST distance (best match) for each file
        if path not in best_distances or dist < best_distances[path]:
            best_distances[path] = dist
            if doc:
                best_chunks[path] = doc
    
    result = [{"path": path, "distance": dist} for path, dist in best_distances.items()]
    result.sort(key=lambda x: x["distance"])
    
    return result, best_chunks


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
    include_distances: bool = False,
    use_reranker: bool = True
) -> List:
    """
    Search for files matching a query using semantic similarity, optionally with reranking.
    
    Args:
        query: Search query string (e.g., "rhetoric", "neural networks")
        k: Number of results to return (default: 5)
        directory: Name of the directory to search in (e.g., "documents1", "documents2")
                   OR a list of directory names to search across multiple directories
        include_distances: If True, return list of dicts with 'path' and 'distance'. 
                          If False, return list of paths (backward compatible)
        use_reranker: If True, use reranker to improve ranking accuracy (default: True)
    
    Returns:
        If include_distances=False: List of file paths (relative to project root)
        If include_distances=True: List of dicts with 'path' and 'distance', sorted by distance
        Duplicates are removed. Lower distance = better match.
        When multiple directories are searched, results are merged and sorted by distance.
        If reranking is used, results are sorted by rerank_score (higher = better).
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
    all_documents = []
    
    for dir_name in directories:
        collection_name = f"files_{dir_name}"
        
        # Check if collection exists, skip if it doesn't
        try:
            collection = client.get_collection(name=collection_name)
        except Exception:
            continue
        
        # Query the vector database for similar chunks
        # Include documents if we're using reranker
        include_list = ["metadatas", "distances"]
        if use_reranker:
            include_list.append("documents")
        
        # Fetch more results if using reranker (we'll rerank and then limit to k)
        n_results = min(k * 3, 50) if use_reranker else k
        res = collection.query(
            query_embeddings=q_emb,
            n_results=n_results,
            include=include_list
        )
        
        # Extract metadata, distances, and documents
        metas = (res.get("metadatas") or [[]])[0]
        distances = (res.get("distances") or [[]])[0]
        documents = (res.get("documents") or [[]])[0] if use_reranker else []
        
        if metas and distances:
            all_metas.extend(metas)
            all_distances.extend(distances)
            if documents:
                all_documents.extend(documents)
    
    if not all_metas or not all_distances:
        return []
    
    # Aggregate: convert chunk-level results to file-level results
    if use_reranker and all_documents:
        aggregated, chunk_texts = aggregate_best_chunk(all_metas, all_distances, all_documents)
    else:
        aggregated = aggregate_best_distance(all_metas, all_distances)
        chunk_texts = {}
    
    # Apply reranking if enabled
    if use_reranker and chunk_texts:
        aggregated = rerank_files(query, aggregated, chunk_texts, top_k=k)
    elif use_reranker and not chunk_texts:
        # Reranker was requested but no chunk texts available
        print(f"Warning: Reranker requested but no chunk texts available (documents were not retrieved)")
        aggregated = aggregated[:k]
    else:
        # Limit to k results (already sorted by distance, best matches first)
        aggregated = aggregated[:k]
    
    if include_distances:
        # Return list of dicts: [{"path": "file.pdf", "distance": 0.2}, ...]
        return aggregated
    else:
        # Return just paths for backward compatibility: ["file.pdf", "file2.pdf", ...]
        return [item["path"] for item in aggregated]
