from django.shortcuts import render

# Create your views here.
from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_GET
from semantic_index.indexer import index_documents
from semantic_index.search import search_files

def home(request):
    """Simple home page view."""
    return HttpResponse("a")


@require_GET
def api_reindex(request):
    """
    Rebuild the semantic search index from all files in the documents folder.
    
    This scans the documents folder, extracts text, creates embeddings, and stores
    them in ChromaDB. Call this after adding new files.
    
    Returns JSON with the number of chunks indexed.
    """
    count = index_documents()
    return JsonResponse({"indexed_chunks": count})


@require_GET
def api_search(request):
    """
    Search for files using semantic similarity.
    
    Query parameters:
    - q (required): Search query string
    - k (optional): Number of results to return (default: 5, max: 50)
    
    Returns JSON with the query and list of matching file paths.
    """
    q = request.GET.get("q", "").strip()
    k_str = request.GET.get("k", "5")
    
    # Validate and clamp k parameter
    try:
        k = max(1, min(50, int(k_str)))
    except ValueError:
        k = 5
    
    if not q:
        return JsonResponse({"error": "missing 'q' parameter"}, status=400)
    
    results = search_files(q, k=k)
    return JsonResponse({"query": q, "results": results})