from django.urls import path
from .views import (
    api_search,
    api_reindex,
    api_reindex_start,
    api_reindex_status,
    api_open,
    api_file,
    api_library_supported,
    api_library_list,
    api_library_upload,
    api_library_import,
    api_tags_list,
    api_tags_for_file,
    api_tags_set,
)

urlpatterns = [
    path("search", api_search),
    path("reindex", api_reindex),
    path("reindex/start", api_reindex_start),
    path("reindex/status", api_reindex_status),
    path("open", api_open),
    path("file", api_file),
    path("library/supported", api_library_supported),
    path("library/list", api_library_list),
    path("library/upload", api_library_upload),
    path("library/import", api_library_import),
    path("tags/list", api_tags_list),
    path("tags/for_file", api_tags_for_file),
    path("tags/set", api_tags_set),
]

