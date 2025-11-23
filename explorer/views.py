from django.shortcuts import render

# Create your views here.
from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_GET
from semantic_index.indexer import index_documents
from semantic_index.search import search_files

def home(request):
    """Simple home page view."""
    return HttpResponse("abc")


@require_GET
def api_reindex(request):
    """
    Rebuild the semantic search index from all files in the specified documents folder.
    
    Query parameters:
    - dir (optional): Directory name to index (default: "documents1")
    
    This scans the documents folder, extracts text, creates embeddings, and stores
    them in ChromaDB. Call this after adding new files.
    
    Returns JSON with the number of chunks indexed.
    """
    directory = request.GET.get("dir", "documents1").strip()
    if not directory:
        return JsonResponse({"error": "directory name cannot be empty"}, status=400)
    
    count = index_documents(directory=directory)
    return JsonResponse({"indexed_chunks": count, "directory": directory})


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
    
    Returns JSON with the query and list of matching file paths.
    If pagination is used, also returns page, page_size, and has_next.
    """
    q = request.GET.get("q", "").strip()
    directory = request.GET.get("dir", "documents1").strip() 

    # this pagination stuff isnt implemented in frontend

    if not q:  
        return JsonResponse({"error": "missing 'q' parameter"}, status=400)
    
    if not directory:
        return JsonResponse({"error": "directory name cannot be empty"}, status=400)
    
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
        all_results = search_files(q, k=k, directory=directory)
        
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
        # this was the original way, this is what is used if no pagination
        k_str = request.GET.get("k", "5")
        
        # Validate and clamp k parameter
        try:
            k = max(1, min(50, int(k_str)))
        except ValueError:
            k = 5
        
        results = search_files(q, k=k, directory=directory)
        return JsonResponse({"query": q, "directory": directory, "results": results})