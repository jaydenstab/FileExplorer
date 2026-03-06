"""
Search result filters - confidence, file type, and distance filtering.
"""
from pathlib import Path
from typing import List, Optional, Set, Tuple, Union


def compute_confidence(result_items: list) -> Tuple[float, str]:
    """
    Compute overall confidence score and level from reranker scores.
    Returns (best_score, level) where level is "high", "medium", or "low".
    """
    best_score = 0.0
    if isinstance(result_items, list):
        for r in result_items:
            if isinstance(r, dict):
                s = float(r.get("rerank_score", 0.0) or 0.0)
                if s > best_score:
                    best_score = s
    if best_score >= 0.8:
        level = "high"
    elif best_score >= 0.3:
        level = "medium"
    else:
        level = "low"
    return best_score, level


def apply_min_confidence(
    results_list: List[Union[dict, str]],
    threshold: Optional[float],
) -> List[Union[dict, str]]:
    """Filter to results with rerank_score >= threshold."""
    if threshold is None or threshold <= 0.0:
        return results_list
    out = []
    for r in results_list:
        if isinstance(r, dict):
            score = float(r.get("rerank_score", 0.0) or 0.0)
            if score >= threshold:
                out.append(r)
    return out


def apply_file_types(
    results_list: List[Union[dict, str]],
    extensions: Optional[Set[str]],
) -> List[Union[dict, str]]:
    """Filter to results whose path has an extension in the allowed set."""
    if extensions is None or not extensions:
        return results_list
    out = []
    for r in results_list:
        path = r.get("path", r) if isinstance(r, dict) else r
        if isinstance(path, str) and Path(path).suffix.lower() in extensions:
            out.append(r)
    return out


def apply_distance_threshold(
    results_list: List[Union[dict, str]],
    threshold: Optional[float],
    include_scores: bool,
) -> List[Union[dict, str]]:
    """Filter to results with distance <= threshold. Optionally convert to paths."""
    if threshold is None:
        return results_list
    filtered = [
        r
        for r in results_list
        if isinstance(r, dict) and r.get("distance", float("inf")) <= threshold
    ]
    if not include_scores:
        filtered = [r["path"] for r in filtered]
    return filtered


def results_to_paths(results_list: List[Union[dict, str]]) -> List[str]:
    """Convert result dicts to path strings when include_scores is false."""
    return [r["path"] if isinstance(r, dict) else r for r in results_list]
