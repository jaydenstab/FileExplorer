"""HTTP API for the file library (upload/import/list) and tagging."""
from __future__ import annotations

import json
from typing import Optional, Set

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods

from semantic_index.indexer import get_supported_exts

from .file_store import get_library_dirname, import_local_paths, list_library_files, store_uploaded_file
from .tag_service import get_file_tags, list_all_tag_names, set_file_tags, validate_library_relative_path


def _parse_ext_filter(raw: str) -> Optional[Set[str]]:
    raw = (raw or "").strip()
    if not raw:
        return None
    parts = [p.strip().lower() for p in raw.split(",") if p.strip()]
    if not parts:
        return None
    return {p if p.startswith(".") else f".{p}" for p in parts}


@require_GET
def api_library_supported(request):
    return JsonResponse(
        {"library_dir": get_library_dirname(), "supported_extensions": sorted(get_supported_exts())}
    )


@require_GET
def api_library_list(request):
    allowed = _parse_ext_filter(request.GET.get("ext", ""))
    files = list_library_files(allowed_extensions=allowed)
    return JsonResponse({"library_dir": get_library_dirname(), "files": [f.__dict__ for f in files]})


@csrf_exempt
@require_http_methods(["POST"])
def api_library_upload(request):
    upload = request.FILES.get("file")
    if upload is None:
        return JsonResponse({"error": "missing multipart field 'file'"}, status=400)
    try:
        stored = store_uploaded_file(upload=upload, subdir=request.POST.get("subdir"))
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"library_dir": get_library_dirname(), "stored": stored.__dict__})


@csrf_exempt
@require_http_methods(["POST"])
def api_library_import(request):
    try:
        body = json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        return JsonResponse({"error": "invalid JSON body"}, status=400)
    paths = body.get("paths")
    if not isinstance(paths, list) or not paths:
        return JsonResponse({"error": "body.paths must be a non-empty list"}, status=400)
    try:
        imported, errors = import_local_paths(paths, subdir=body.get("subdir"))
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse(
        {"library_dir": get_library_dirname(), "imported": [f.__dict__ for f in imported], "errors": errors}
    )


@require_GET
def api_tags_list(request):
    return JsonResponse({"tags": list_all_tag_names()})


@require_GET
def api_tags_for_file(request):
    path = (request.GET.get("path") or "").strip()
    try:
        rel = validate_library_relative_path(path)
        tags = get_file_tags(path=rel)
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    return JsonResponse({"library_dir": get_library_dirname(), "path": rel, "tags": tags})


@csrf_exempt
@require_http_methods(["POST"])
def api_tags_set(request):
    try:
        body = json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        return JsonResponse({"error": "invalid JSON body"}, status=400)
    path = (body.get("path") or "").strip()
    tags = body.get("tags") or []
    if not isinstance(tags, list):
        return JsonResponse({"error": "body.tags must be a list"}, status=400)
    try:
        rel = validate_library_relative_path(path)
        final = set_file_tags(path=rel, tag_names=tags)
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"library_dir": get_library_dirname(), "path": rel, "tags": final})
