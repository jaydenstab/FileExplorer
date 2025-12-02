"""
Main views module - imports views from separate modules for better organization.

This file acts as a central import point. Views are split into:
- views_search.py: Search functionality with distance filtering
- views_reindex.py: Indexing functionality with progress tracking
"""
from django.http import HttpResponse
from .views_search import api_search
from .views_reindex import api_reindex, api_reindex_start, api_reindex_status

# Export all views for use in urls.py
__all__ = ['home', 'api_search', 'api_reindex', 'api_reindex_start', 'api_reindex_status']


def home(request):
    """Simple home page view."""
    return HttpResponse("a")