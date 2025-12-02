"""
Search API views - handles semantic file search with pagination and distance filtering.
"""
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from semantic_index.search import search_files


@require_GET
def api_search(request):
    """
    Search for files using semantic similarity.
    
    Query parameters:
    - q (required): Search query string
    - k (optional): Number of results to return (default: 5, max: 50) - used when pagination not specified
    - page (optional): Page number for pagination (default: 1)
    - page_size (optional): Number of results per page (default: 5, max: 50)
    - dir (optional): Directory name to search in (default: "documents1")
    - include_scores (optional): If "true", return results with distance scores (default: false)
    - distance_threshold (optional): Filter results by maximum distance (lower = better match, default: no filter)
    
    Returns JSON with the query and list of matching file paths.
    If pagination is used, also returns page, page_size, and has_next.
    If include_scores=true, results are dicts with 'path' and 'distance'.
    """
    q = request.GET.get("q", "").strip()
    directory = request.GET.get("dir", "documents1").strip() 

    # GET /api/search?q=your query&dir=documents1
    # GET /api/search?q=your query&dir=documents2, can do this to search in different directories 
    # idk how to do this in frontend

    # this pagination stuff isnt implemented in frontend

    if not q:  
        return JsonResponse({"error": "missing 'q' parameter"}, status=400)
    
    if not directory:
        return JsonResponse({"error": "directory name cannot be empty"}, status=400)
    
    # PARSE DISTANCE FILTERING PARAMETERS
    # include_scores: If true, return results with distance scores (e.g., {"path": "...", "distance": 0.2})
    #                 If false, return just paths (backward compatible: ["path1", "path2"])
    include_scores = request.GET.get("include_scores", "false").lower() == "true"
    
    # distance_threshold: Filter results - only return files with distance <= threshold
    #                     Lower distance = better match (e.g., 0.2 is better than 0.8)
    #                     If not specified, return all results
    distance_threshold_str = request.GET.get("distance_threshold")
    distance_threshold = None
    if distance_threshold_str:
        try:
            distance_threshold = max(0.0, float(distance_threshold_str))  # Ensure non-negative
        except ValueError:
            pass  # Invalid number, ignore threshold
    
    # Check if pagination parameters are provided
    page_str = request.GET.get("page")
    size_str = request.GET.get("page_size")
    
    if page_str or size_str:
        # Pagination mode
        try:
            page = max(1, int(page_str or "1"))
        except ValueError:
            page = 1 #default to 1
        
        try:
            page_size = min(50, max(1, int(size_str or "5")))
        except ValueError:
            page_size = 5 #default to 5
        
        # Fetch one extra item to determine if there's a next page
        k = min(page * page_size + 1, 200)
        
        # DISTANCE FILTERING LOGIC:
        # If user wants scores OR wants to filter by threshold, we need distances
        # (can't filter without knowing distances, even if we don't return them)
        need_distances = include_scores or (distance_threshold is not None)
        all_results = search_files(q, k=k, directory=directory, include_distances=need_distances)
        
        # Apply distance threshold filter if specified
        # Example: threshold=0.3 means "only show results with distance <= 0.3"
        if distance_threshold is not None:
            if include_scores:
                # Results are dicts: [{"path": "...", "distance": 0.2}, ...]
                # Filter: keep only results where distance <= threshold
                all_results = [r for r in all_results if r.get("distance", float('inf')) <= distance_threshold]
            else:
                # Results are dicts but user doesn't want scores in response
                # Filter first, then extract just paths
                filtered = [r for r in all_results if r.get("distance", float('inf')) <= distance_threshold]
                all_results = [r["path"] for r in filtered]
        elif not include_scores:
            # No threshold, but user doesn't want scores
            # Convert dicts to paths: [{"path": "..."}, ...] → ["...", ...]
            all_results = [r["path"] if isinstance(r, dict) else r for r in all_results]
        
        # Slice results for the requested page
        start = (page - 1) * page_size
        end = start + page_size
        items = all_results[start:end]
        has_next = len(all_results) > end
        
        return JsonResponse({
            "query": q,
            "directory": directory,
            "page": page,
            "page_size": page_size,
            "has_next": has_next,
            "results": items,
        })
    else:
        # Legacy mode: use k parameter
        k_str = request.GET.get("k", "5")
        
        # Validate and clamp k parameter
        try:
            k = max(1, min(50, int(k_str)))
        except ValueError:
            k = 5
        
        # DISTANCE FILTERING LOGIC (same as pagination mode above)
        # Get distances if user wants scores OR wants to filter by threshold
        need_distances = include_scores or (distance_threshold is not None)
        results = search_files(q, k=k, directory=directory, include_distances=need_distances)
        
        # Apply distance threshold filter if specified
        if distance_threshold is not None:
            if include_scores:
                # Keep dicts with distance, but filter by threshold
                results = [r for r in results if r.get("distance", float('inf')) <= distance_threshold]
            else:
                # Filter dicts, then extract just paths
                filtered = [r for r in results if r.get("distance", float('inf')) <= distance_threshold]
                results = [r["path"] for r in filtered]
        elif not include_scores:
            # No threshold, convert dicts to paths for backward compatibility
            results = [r["path"] if isinstance(r, dict) else r for r in results]
        
        return JsonResponse({"query": q, "directory": directory, "results": results})

