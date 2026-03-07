"""
Reranker module - uses BAAI/bge-reranker-v2-m3 to rerank search results for better accuracy.
"""
from typing import List, Dict, Tuple, Optional, Any
from functools import lru_cache

try:
    from FlagEmbedding import FlagReranker
except ImportError:
    FlagReranker = None

# Reranker model configuration
RERANKER_MODEL = "BAAI/bge-reranker-v2-m3"


class RerankerError(Exception):
    """Raised when reranking is requested but fails to initialize or compute."""


@lru_cache(maxsize=1)
def _get_reranker():
    """Load and cache the reranker model (only loads once, reused for all operations)."""
    if FlagReranker is None:
        raise RerankerError(
            "FlagEmbedding is not installed. Install it with: pip install FlagEmbedding"
        )
    # use_fp16=False and devices="cpu" avoid meta-tensor / MPS compatibility issues
    return FlagReranker(RERANKER_MODEL, use_fp16=False, devices="cpu")


def rerank_files(
    query: str,
    file_results: List[Dict[str, Any]],
    chunk_texts: Dict[str, str],
    top_k: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Rerank file search results using the BAAI reranker model.
    
    Args:
        query: Search query string
        file_results: List of file result dicts with 'path' and optionally 'distance'
        chunk_texts: Dict mapping file paths to their best matching chunk text
        top_k: Optional limit on number of results to return after reranking
    
    Returns:
        List of file result dicts, reranked by relevance score (highest first).
        Each dict includes 'path', 'rerank_score' (0-1 range, higher = better), and optionally 'distance'.
        
    Note:
        rerank_score is normalized to 0-1 range using sigmoid:
        - Scores closer to 1.0 = very relevant match
        - Scores closer to 0.0 = less relevant match
        - Scores are sorted in descending order (best matches first)
    """
    if not file_results or not chunk_texts:
        return file_results

    try:
        reranker = _get_reranker()
    except RerankerError:
        raise
    except Exception as e:
        raise RerankerError(f"Reranker failed to initialize: {e}") from e
    
    # Prepare query-document pairs for reranking
    pairs = []
    valid_results = []
    
    for result in file_results:
        path = result.get("path")
        if not path or path not in chunk_texts:
            continue
        
        chunk_text = chunk_texts[path]
        if not chunk_text or not chunk_text.strip():
            continue
        
        pairs.append([query, chunk_text])
        valid_results.append(result)
    
    if not pairs:
        raise RerankerError(
            f"No valid pairs for reranking (file_results: {len(file_results)}, chunk_texts: {len(chunk_texts)})"
        )

    # Compute reranker scores
    # normalize=True applies sigmoid to convert raw logits to 0-1 range
    # Higher scores (closer to 1) = better relevance match
    try:
        scores = reranker.compute_score(pairs, normalize=True)
        # Handle both single score and list of scores
        if not isinstance(scores, list):
            scores = [scores]
    except Exception as e:
        raise RerankerError(f"Reranker failed during scoring: {e}") from e
    
    # Add rerank scores to results
    for i, result in enumerate(valid_results):
        if i < len(scores):
            result["rerank_score"] = float(scores[i])
    
    # Sort by rerank score (highest first = best matches first)
    valid_results.sort(key=lambda x: x.get("rerank_score", float("-inf")), reverse=True)
    
    # Apply top_k limit if specified
    if top_k is not None:
        valid_results = valid_results[:top_k]
    
    return valid_results
