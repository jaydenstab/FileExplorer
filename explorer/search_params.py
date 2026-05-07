"""
Parse search API query parameters into a structured form.
"""
from typing import List, Optional, Set
from .path_policy import normalize_directory


def parse_search_params(request) -> dict:
    """
    Parse and validate search query parameters from a Django request.
    Returns a dict with: q, directories, include_scores, distance_threshold,
    use_reranker, min_confidence_threshold, allowed_extensions,
    search_mode ("semantic" | "text"), case_sensitive (for text mode).
    """
    q = request.GET.get("q", "").strip()

    dirs_param = request.GET.get("dirs", "").strip()
    errors: List[str] = []
    if dirs_param:
        raw_directories = [d.strip() for d in dirs_param.split(",") if d.strip()]
    else:
        dir_param = request.GET.get("dir", "documents1").strip()
        raw_directories = [dir_param] if dir_param else ["documents1"]
    directories: List[str] = []
    for d in raw_directories:
        try:
            directories.append(normalize_directory(d))
        except ValueError as e:
            errors.append(str(e))

    include_scores = request.GET.get("include_scores", "false").lower() == "true"

    distance_threshold_str = request.GET.get("distance_threshold")
    distance_threshold: Optional[float] = None
    if distance_threshold_str:
        try:
            raw = float(distance_threshold_str)
            # Clamp to valid range for cosine distance (0-2)
            distance_threshold = max(0.0, min(2.0, raw))
        except ValueError:
            errors.append("distance_threshold must be a number")

    use_reranker = request.GET.get("use_reranker", "true").lower() == "true"

    min_confidence_raw = request.GET.get("min_confidence", "").strip().lower()
    MIN_CONFIDENCE_THRESHOLDS = {"high": 0.8, "medium": 0.3, "low": 0.0}
    min_confidence_threshold = (
        MIN_CONFIDENCE_THRESHOLDS.get(min_confidence_raw) if min_confidence_raw else None
    )

    file_types_param = request.GET.get("file_types", "").strip()
    allowed_extensions: Optional[Set[str]] = None
    if file_types_param:
        parts = [p.strip().lower() for p in file_types_param.split(",") if p.strip()]
        if parts:
            allowed_extensions = set()
            for p in parts:
                ext = p if p.startswith(".") else f".{p}"
                allowed_extensions.add(ext)

    search_mode_raw = request.GET.get("search_mode", "semantic").strip().lower()
    search_mode: Optional[str]
    if search_mode_raw in ("semantic", "text"):
        search_mode = search_mode_raw
    else:
        search_mode = None

    case_sensitive = request.GET.get("case_sensitive", "false").lower() == "true"

    tags_param = request.GET.get("tags", "").strip()
    tags: List[str] = [t.strip() for t in tags_param.split(",") if t.strip()] if tags_param else []
    tag_match = request.GET.get("tag_match", "any").strip().lower()
    if tag_match not in ("any", "all"):
        errors.append("tag_match must be 'any' or 'all'")
        tag_match = "any"

    return {
        "q": q,
        "directories": directories,
        "include_scores": include_scores,
        "distance_threshold": distance_threshold,
        "use_reranker": use_reranker,
        "min_confidence_threshold": min_confidence_threshold,
        "allowed_extensions": allowed_extensions,
        "search_mode": search_mode,
        "case_sensitive": case_sensitive,
        "tags": tags,
        "tag_match": tag_match,
        "errors": errors,
    }
