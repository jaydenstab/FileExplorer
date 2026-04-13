"""
Run semantic (vector + optional reranker) vs plain-text search for the HTTP API.

Keeps `views_search` thin: parameter shapes and JSON stay in the view layer.
"""
from typing import Any, List, Optional, Set, Tuple

from semantic_index.search import search_files
from semantic_index.substring_search import search_files_plain_text

from .search_filters import (
    apply_distance_threshold,
    apply_file_types,
    apply_min_confidence,
    compute_confidence,
    results_to_paths,
)
from .tag_service import filter_results_by_tags


def semantic_search_raw(
    q: str,
    directories: List[str],
    k: int,
    need_distances: bool,
    use_reranker: bool,
) -> List[Any]:
    """Chroma + embeddings + optional reranker."""
    return search_files(
        q,
        k=k,
        directory=directories,
        include_distances=need_distances,
        use_reranker=use_reranker,
    )


def apply_semantic_result_filters(
    raw: List[Any],
    *,
    include_scores: bool,
    use_reranker: bool,
    min_confidence_threshold: Optional[float],
    allowed_extensions: Optional[Set[str]],
    distance_threshold: Optional[float],
    tags: Optional[List[str]] = None,
    tag_match: str = "any",
) -> List[Any]:
    out = list(raw)
    if use_reranker and min_confidence_threshold is not None:
        out = apply_min_confidence(out, min_confidence_threshold)
    if allowed_extensions is not None:
        out = apply_file_types(out, allowed_extensions)
    if tags:
        out = filter_results_by_tags(out, tags, match=tag_match)
    if distance_threshold is not None:
        out = apply_distance_threshold(out, distance_threshold, include_scores)
    elif not include_scores:
        out = results_to_paths(out)
    return out


def plain_text_search_raw(
    q: str,
    directories: List[str],
    k: int,
    include_scores: bool,
    allowed_extensions: Optional[Set[str]],
    case_sensitive: bool,
) -> List[Any]:
    """Substring scan over files; no vector DB or reranker."""
    return search_files_plain_text(
        q,
        directories,
        k=k,
        include_match_counts=include_scores,
        case_sensitive=case_sensitive,
        allowed_extensions=allowed_extensions,
    )


def finalize_plain_text_results(raw: List[Any], *, include_scores: bool) -> List[Any]:
    """Paths-only when the client did not request per-file details."""
    if not include_scores:
        return results_to_paths(raw)
    return raw


def apply_plain_text_tag_filter(
    raw: List[Any],
    *,
    include_scores: bool,
    tags: Optional[List[str]] = None,
    tag_match: str = "any",
) -> List[Any]:
    if not tags:
        return raw
    return filter_results_by_tags(raw, tags, match=tag_match)


def confidence_for_semantic(raw: List[Any]) -> Tuple[Optional[float], Optional[str]]:
    score, level = compute_confidence(raw)
    return score, level


def confidence_for_plain_text() -> Tuple[Optional[float], Optional[str]]:
    return None, None
