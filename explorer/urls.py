from django.urls import path
from .views import api_search, api_reindex

urlpatterns = [
    path("search", api_search),
    path("reindex", api_reindex),
]

