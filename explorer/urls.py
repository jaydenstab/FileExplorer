from django.urls import path
from .views import api_search, api_reindex, api_reindex_start, api_reindex_status

urlpatterns = [
    path("search", api_search),
    path("reindex", api_reindex),
    path("reindex/start", api_reindex_start),
    path("reindex/status", api_reindex_status),
]

