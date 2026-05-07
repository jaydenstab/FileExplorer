"""
Search API views - semantic (vector DB + reranker) or plain-text (substring) mode.
"""
from django.views.decorators.http import require_GET

from semantic_index.search import RerankerError

from .search_execution import (
    apply_plain_text_tag_filter,
    apply_semantic_result_filters,
    confidence_for_plain_text,
    confidence_for_semantic,
    finalize_plain_text_results,
    plain_text_search_raw,
    semantic_search_raw,
)
from .search_params import parse_search_params
from .api_response import api_error, api_ok


def _json_base(
    *,
    q: str,
    directories: list,
    search_mode: str,
    query_confidence_score,
    query_confidence_level,
    **extra,
):
    body = {
        "query": q,
        "directories": directories,
        "search_mode": search_mode,
        "query_confidence_score": query_confidence_score,
        "query_confidence_level": query_confidence_level,
        **extra,
    }
    return api_ok(body)


@require_GET
def api_search(request):
    """
    Query parameters (existing):
    - q, k, page, page_size, dir, dirs, include_scores,
      distance_threshold, use_reranker, min_confidence, file_types
    - tags (optional): comma-separated tag names; limits results to tagged paths
    - tag_match (optional): any | all (default any)

    Plain-text mode (no Chroma / reranker):
    - search_mode=text — substring search over file contents (default: semantic).
    - case_sensitive=true — literal-case matching (default: false).

    With search_mode=text, distance_threshold / use_reranker / min_confidence are ignored.
    When include_scores=true, each result includes ``match_count`` (non-overlapping substring hits).
    """
    params = parse_search_params(request)
    q = params["q"]
    directories = params["directories"]
    include_scores = params["include_scores"]
    distance_threshold = params["distance_threshold"]
    use_reranker = params["use_reranker"]
    min_confidence_threshold = params["min_confidence_threshold"]
    allowed_extensions = params["allowed_extensions"]
    search_mode = params["search_mode"]
    case_sensitive = params["case_sensitive"]
    tags = params["tags"]
    tag_match = params["tag_match"]
    errors = params["errors"]

    if not q:
        return api_error("missing_query", "missing 'q' parameter", 400)
    if not directories or not all(directories):
        return api_error(
            "invalid_directories", "at least one directory must be specified", 400
        )
    if errors:
        return api_error("invalid_query_params", "Invalid search parameters", 400, details={"errors": errors})
    if search_mode is None:
        return api_error(
            "invalid_search_mode",
            "search_mode must be 'semantic' or 'text'",
            400,
        )

    page_str = request.GET.get("page")
    size_str = request.GET.get("page_size")

    if page_str or size_str:
        try:
            page = max(1, int(page_str or "1"))
        except ValueError:
            page = 1
        try:
            page_size = min(50, max(1, int(size_str or "5")))
        except ValueError:
            page_size = 5

        k = min(page * page_size + 1, 200)

        if search_mode == "text":
            raw = plain_text_search_raw(
                q,
                directories,
                k=k,
                include_scores=include_scores,
                allowed_extensions=allowed_extensions,
                case_sensitive=case_sensitive,
            )
            raw = apply_plain_text_tag_filter(
                raw, include_scores=include_scores, tags=tags, tag_match=tag_match
            )
            q_conf_score, q_conf_level = confidence_for_plain_text()
            all_results = finalize_plain_text_results(raw, include_scores=include_scores)
        else:
            need_distances = (
                include_scores or (distance_threshold is not None) or use_reranker
            )
            try:
                raw = semantic_search_raw(
                    q, directories, k, need_distances, use_reranker
                )
            except RerankerError as e:
                return api_error("reranker_unavailable", str(e), 503)
            q_conf_score, q_conf_level = confidence_for_semantic(raw)
            all_results = apply_semantic_result_filters(
                raw,
                include_scores=include_scores,
                use_reranker=use_reranker,
                min_confidence_threshold=min_confidence_threshold,
                allowed_extensions=allowed_extensions,
                distance_threshold=distance_threshold,
                tags=tags,
                tag_match=tag_match,
            )

        start = (page - 1) * page_size
        end = start + page_size
        items = all_results[start:end]
        has_next = len(all_results) > end

        return _json_base(
            q=q,
            directories=directories,
            search_mode=search_mode,
            query_confidence_score=q_conf_score,
            query_confidence_level=q_conf_level,
            page=page,
            page_size=page_size,
            has_next=has_next,
            results=items,
        )

    try:
        k = max(1, min(50, int(request.GET.get("k", "5"))))
    except ValueError:
        k = 5

    if search_mode == "text":
        raw = plain_text_search_raw(
            q,
            directories,
            k=k,
            include_scores=include_scores,
            allowed_extensions=allowed_extensions,
            case_sensitive=case_sensitive,
        )
        raw = apply_plain_text_tag_filter(
            raw, include_scores=include_scores, tags=tags, tag_match=tag_match
        )
        q_conf_score, q_conf_level = confidence_for_plain_text()
        results = finalize_plain_text_results(raw, include_scores=include_scores)
    else:
        need_distances = (
            include_scores or (distance_threshold is not None) or use_reranker
        )
        try:
            raw = semantic_search_raw(q, directories, k, need_distances, use_reranker)
        except RerankerError as e:
            return api_error("reranker_unavailable", str(e), 503)
        q_conf_score, q_conf_level = confidence_for_semantic(raw)
        results = apply_semantic_result_filters(
            raw,
            include_scores=include_scores,
            use_reranker=use_reranker,
            min_confidence_threshold=min_confidence_threshold,
            allowed_extensions=allowed_extensions,
            distance_threshold=distance_threshold,
            tags=tags,
            tag_match=tag_match,
        )

    return _json_base(
        q=q,
        directories=directories,
        search_mode=search_mode,
        query_confidence_score=q_conf_score,
        query_confidence_level=q_conf_level,
        results=results,
    )
