"""
Search API views - handles semantic file search with pagination and filtering.
"""
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from semantic_index.search import search_files

from .search_filters import (
    apply_distance_threshold,
    apply_file_types,
    apply_min_confidence,
    compute_confidence,
    results_to_paths,
)
from .search_params import parse_search_params


@require_GET
def api_search(request):
    """
    Search for files using semantic similarity.

    Query parameters:
    - q (required): Search query string
    - k (optional): Number of results to return (default: 5, max: 50) - used when pagination not specified
    - page (optional): Page number for pagination (default: 1)
    - page_size (optional): Number of results per page (default: 5, max: 50)
    - dir (optional): Directory name to search in (default: "documents1"). Use for single directory.
    - dirs (optional): Comma-separated list of directories to search (e.g., "documents1,documents2").
                      If provided, overrides 'dir' parameter. Allows searching multiple directories.
    - include_scores (optional): If "true", return results with distance scores (default: false)
    - distance_threshold (optional): Filter results by maximum distance (lower = better match, default: no filter)
    - use_reranker (optional): If "true", use reranker to improve ranking (default: true). If "false", use distance-based ranking only.
    - min_confidence (optional): Only return results at or above this confidence: "high", "medium", or "low".
                                 E.g. "medium" hides low-confidence answers; "high" shows only high-confidence.
                                 Only applied when use_reranker=true (uses per-result rerank_score).
    - file_types (optional): Comma-separated list of file types to include (e.g. "pdf,txt" or "pdf").
                             Only results whose path ends with one of these extensions are returned.
                             Extensions are normalized (e.g. "pdf" and ".pdf" both match .pdf files).

    Returns JSON with the query and list of matching file paths.
    If pagination is used, also returns page, page_size, and has_next.
    If include_scores=true, results are dicts with 'path' and 'distance'.
    """
    params = parse_search_params(request)
    q = params["q"]
    directories = params["directories"]
    include_scores = params["include_scores"]
    distance_threshold = params["distance_threshold"]
    use_reranker = params["use_reranker"]
    min_confidence_threshold = params["min_confidence_threshold"]
    allowed_extensions = params["allowed_extensions"]

    if not q:
        return JsonResponse({"error": "missing 'q' parameter"}, status=400)
    if not directories or not all(directories):
        return JsonResponse({"error": "at least one directory must be specified"}, status=400)

    need_distances = include_scores or (distance_threshold is not None) or use_reranker

    def _apply_filters(results):
        out = list(results)
        if use_reranker and min_confidence_threshold is not None:
            out = apply_min_confidence(out, min_confidence_threshold)
        if allowed_extensions is not None:
            out = apply_file_types(out, allowed_extensions)
        if distance_threshold is not None:
            out = apply_distance_threshold(out, distance_threshold, include_scores)
        elif not include_scores:
            out = results_to_paths(out)
        return out

    page_str = request.GET.get("page")
    size_str = request.GET.get("page_size")

    if page_str or size_str:
        # Pagination mode
        try:
            page = max(1, int(page_str or "1"))
        except ValueError:
            page = 1
        try:
            page_size = min(50, max(1, int(size_str or "5")))
        except ValueError:
            page_size = 5

        k = min(page * page_size + 1, 200)
        raw = search_files(
            q,
            k=k,
            directory=directories,
            include_distances=need_distances,
            use_reranker=use_reranker,
        )
        query_conf_score, query_conf_level = compute_confidence(raw)
        all_results = _apply_filters(raw)

        start = (page - 1) * page_size
        end = start + page_size
        items = all_results[start:end]
        has_next = len(all_results) > end

        return JsonResponse({
            "query": q,
            "directories": directories,
            "page": page,
            "page_size": page_size,
            "has_next": has_next,
            "results": items,
            "query_confidence_score": query_conf_score,
            "query_confidence_level": query_conf_level,
        })

    # Legacy mode: use k parameter
    try:
        k = max(1, min(50, int(request.GET.get("k", "5"))))
    except ValueError:
        k = 5

    raw = search_files(
        q,
        k=k,
        directory=directories,
        include_distances=need_distances,
        use_reranker=use_reranker,
    )
    query_conf_score, query_conf_level = compute_confidence(raw)
    results = _apply_filters(raw)

    return JsonResponse({
        "query": q,
        "directories": directories,
        "results": results,
        "query_confidence_score": query_conf_score,
        "query_confidence_level": query_conf_level,
    })
