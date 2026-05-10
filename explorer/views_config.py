"""Read-only configuration endpoints for the explorer UI."""
from __future__ import annotations

from django.views.decorators.http import require_GET

from .api_response import api_ok
from .document_roots import get_document_root_dirs


@require_GET
def api_document_roots(request):
    """Return persisted document root directory names (search scope, excluding library)."""
    return api_ok({"roots": get_document_root_dirs()})
