"""
Reindexing API views - handles rebuilding the semantic search index with progress tracking.
"""
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_http_methods
from django.views.decorators.csrf import csrf_exempt
from semantic_index.indexer import index_documents
from semantic_index.progress import start_job, update_job, finish_job, fail_job, get_job
import threading


@require_GET
def api_reindex(request):
    """
    Rebuild the semantic search index from all files in the specified documents folder.
    
    Query parameters:
    - dir (optional): Directory name to index (default: "documents1")
    
    This scans the documents folder, extracts text, creates embeddings, and stores
    them in ChromaDB. Call this after adding new files.
    
    Returns JSON with the number of chunks indexed.
    
    Note: This is the legacy synchronous endpoint. For progress tracking, use
    /api/reindex/start instead.
    """
    directory = request.GET.get("dir", "documents1").strip()
    if not directory:
        return JsonResponse({"error": "directory name cannot be empty"}, status=400)
    
    count = index_documents(directory=directory)
    return JsonResponse({"indexed_chunks": count, "directory": directory})

def _run_indexing(job_id: str, directory: str, slow_ms: int):
    """
    Background function to run indexing with progress tracking.
    
    This runs in a separate thread so the HTTP request can return immediately
    with a job_id, while indexing continues in the background.
    
    Args:
        job_id: Job identifier for progress tracking (UUID string)
        directory: Directory to index (e.g., "documents1")
        slow_ms: Artificial delay in milliseconds per file (for testing progress bar)
    """
    # Use list [0] instead of int because Python's nested functions can't modify
    # outer scope variables directly, but they CAN modify list contents
    total_files = [0]  # Will store total number of files found
    
    def progress_callback(current: int, total: int, current_file: str = None, phase: str = "reading"):
        """
        This callback is called by index_documents() as it processes files.
        It updates the progress store so the frontend can poll and see progress.
        """
        total_files[0] = total  # Track total files (needed for finish_job)
        update_job(job_id, current, total, current_file, phase)
    
    try:
        # Run the actual indexing (this takes time)
        count = index_documents(
            directory=directory,
            progress_callback=progress_callback,  # Called repeatedly during indexing
            slow_ms=slow_ms
        )
        # count = number of CHUNKS indexed, but finish_job needs number of FILES
        # So we use total_files[0] which was set by the callback
        finish_job(job_id, total_files[0])
    except Exception as e:
        # If anything goes wrong, mark job as failed
        fail_job(job_id, str(e))


@csrf_exempt
@require_http_methods(["POST"])
def api_reindex_start(request):
    """
    Start an indexing job in the background.
    
    Query parameters:
    - dir (optional): Directory name to index (default: "documents1")
    - slow_ms (optional): Artificial delay in milliseconds per file (default: 0, for testing)
    
    Returns JSON with job_id that can be used to check progress.
    """
    directory = request.GET.get("dir", "documents1").strip()
    if not directory:
        return JsonResponse({"error": "directory name cannot be empty"}, status=400)
    
    # Parse slow_ms parameter (artificial delay for testing progress bar)
    # Example: slow_ms=250 means wait 0.25 seconds per file
    slow_ms_str = request.GET.get("slow_ms", "0")
    try:
        slow_ms = max(0, int(slow_ms_str))  # Ensure non-negative
    except ValueError:
        slow_ms = 0  # Default: no delay
    
    # Create a new job in the progress store
    # total=0 initially because we don't know how many files yet
    job_id = start_job(directory, total=0)
    
    # BACKGROUND THREADING: Start indexing in a separate thread
    # This allows the HTTP request to return immediately with job_id,
    # while indexing continues in the background
    thread = threading.Thread(target=_run_indexing, args=(job_id, directory, slow_ms))
    thread.daemon = True  # Thread dies when main program exits
    thread.start()  # Start the thread (calls _run_indexing)
    
    # Return immediately - don't wait for indexing to finish
    return JsonResponse({"job_id": job_id})


@require_GET
def api_reindex_status(request):
    """
    Get the current progress of an indexing job.
    
    Query parameters:
    - job_id (required): Job identifier returned from /api/reindex/start
    
    Returns JSON with progress information:
    {
        "job_id": "...",
        "status": "indexing" | "completed" | "error",
        "directory": "documents1",
        "current": 3,
        "total": 12,
        "percent": 25.0,
        "current_file": "documents1/file.pdf",
        "phase": "reading" | "embedding" | "storing" | "completed",
        "updated_at": "2024-01-01T12:00:00",
        "error": "..." (only if status is "error")
    }
    
    Returns 404 if job_id not found.
    """
    job_id = request.GET.get("job_id", "").strip()
    if not job_id:
        return JsonResponse({"error": "missing 'job_id' parameter"}, status=400)
    
    progress = get_job(job_id)
    if progress is None:
        return JsonResponse({"error": "Job not found"}, status=404)
    
    return JsonResponse(progress)