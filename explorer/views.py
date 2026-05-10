"""
Main views module - imports views from separate modules for better organization.

This file acts as a central import point. Views are split into:
- views_search.py: Search functionality with distance filtering
- views_reindex.py: Indexing functionality with progress tracking
- views_open.py: File opening functionality (preview and OS open)
- views_library.py: User file library (upload/import) and tagging APIs
"""
from django.http import HttpResponse
from .views_search import api_search
from .views_reindex import api_reindex, api_reindex_start, api_reindex_status
from .views_open import api_open, api_file
from .views_library import (
    api_library_supported,
    api_library_list,
    api_library_upload,
    api_library_import,
    api_tags_list,
    api_tags_for_file,
    api_tags_set,
)
from .views_recent import api_recent
from .views_fs import api_fs_rename
from .views_config import api_document_roots

# Export all views for use in urls.py
__all__ = [
    "home",
    "api_search",
    "api_reindex",
    "api_reindex_start",
    "api_reindex_status",
    "api_open",
    "api_file",
    "api_library_supported",
    "api_library_list",
    "api_library_upload",
    "api_library_import",
    "api_tags_list",
    "api_tags_for_file",
    "api_tags_set",
    "api_recent",
    "api_fs_rename",
    "api_document_roots",
]


def home(request):
    """Simple home page view."""
    return HttpResponse("a")