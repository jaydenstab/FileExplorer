"""
Progress tracking module for indexing operations.
Stores progress in memory, keyed by job_id (UUID).

This module allows the frontend to track indexing progress by:
1. Creating a job with start_job() - returns a unique job_id
2. Updating progress with update_job() as files are processed
3. Checking progress with get_job() using the job_id
4. Marking completion with finish_job() or failure with fail_job()

Note: This uses in-memory storage (a Python dictionary). For production with
multiple servers, you'd want to use Redis or a database instead.
"""
from typing import Dict, Optional
from datetime import datetime
import uuid

# In-memory storage for progress tracking
# Key: job_id (UUID string), Value: dict with progress info
# This is a module-level variable shared across all requests
_progress_store: Dict[str, dict] = {}


def start_job(directory: str, total: int = 0) -> str:
    """
    Start a new indexing job and return its job_id.
    
    Args:
        directory: Directory name being indexed
        total: Total number of files to index (0 if unknown initially)
    
    Returns:
        job_id: Unique identifier for this job
    """
    job_id = str(uuid.uuid4())
    _progress_store[job_id] = {
        "job_id": job_id,
        "directory": directory,
        "status": "indexing",
        "current": 0,
        "total": total,
        "percent": 0.0,
        "current_file": None,
        "phase": "starting",
        "updated_at": datetime.now().isoformat(),
    }
    return job_id


def update_job(job_id: str, current: int, total: int, current_file: Optional[str] = None, phase: str = "reading"):
    """
    Update progress for a job.
    
    This is called repeatedly during indexing to update the progress percentage.
    The percentage is calculated as: (current / total) * 100
    
    Args:
        job_id: Job identifier
        current: Current file number (1-indexed, e.g., 3 means "processing 3rd file")
        total: Total number of files
        current_file: Name of file currently being processed (e.g., "documents1/file.pdf")
        phase: Current phase ("reading", "embedding", "storing")
    """
    if job_id not in _progress_store:
        return
    
    # Calculate percentage: if 3 out of 12 files done, that's 25%
    percent = (current / total * 100) if total > 0 else 0.0
    
    # Update the stored progress info
    _progress_store[job_id].update({
        "current": current,
        "total": total,
        "percent": round(percent, 1),  # Round to 1 decimal place (e.g., 25.0)
        "current_file": current_file,
        "phase": phase,
        "updated_at": datetime.now().isoformat(),  # Timestamp for "last updated"
    })


def finish_job(job_id: str, total: int):
    """
    Mark a job as completed.
    
    Args:
        job_id: Job identifier
        total: Total number of files processed
    """
    if job_id not in _progress_store:
        return
    
    _progress_store[job_id].update({
        "status": "completed",
        "current": total,
        "total": total,
        "percent": 100.0,
        "current_file": None,
        "phase": "completed",
        "updated_at": datetime.now().isoformat(),
    })


def fail_job(job_id: str, error: str):
    """
    Mark a job as failed.
    
    Args:
        job_id: Job identifier
        error: Error message
    """
    if job_id not in _progress_store:
        return
    
    _progress_store[job_id].update({
        "status": "error",
        "error": error,
        "updated_at": datetime.now().isoformat(),
    })


def get_job(job_id: str) -> Optional[dict]:
    """
    Get current progress for a job.
    
    Args:
        job_id: Job identifier
        
    Returns:
        Progress dict or None if job not found
    """
    return _progress_store.get(job_id)


def clear_job(job_id: str):
    """
    Clear a job from the store (optional cleanup).
    
    Args:
        job_id: Job identifier
    """
    if job_id in _progress_store:
        del _progress_store[job_id]

