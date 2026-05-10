"""Recently modified files under allowed index roots (for nav / Explorer UI)."""
from __future__ import annotations

import time
from typing import Dict, List, Tuple

from django.views.decorators.http import require_GET

from semantic_index.indexer import BASE_DIR, list_indexable_files

from .api_response import api_error, api_ok
from .path_policy import allowed_search_directories, normalize_directory

_RECENT_CACHE: Dict[str, Tuple[float, List[dict]]] = {}
_RECENT_TTL_SEC = 15.0
_MAX_LIMIT = 50
_DEFAULT_LIMIT = 15


def _parse_dirs_param(raw: str) -> List[str]:
    if not raw.strip():
        return allowed_search_directories()
    allowed = set(allowed_search_directories())
    out: List[str] = []
    for part in raw.split(","):
        p = part.strip()
        if not p:
            continue
        try:
            d = normalize_directory(p)
        except ValueError:
            continue
        if d in allowed and d not in out:
            out.append(d)
    return out or list(allowed)


def _collect_recent(directories: List[str], limit: int) -> List[dict]:
    items: List[dict] = []
    for root_name in directories:
        for abs_path in list_indexable_files(root_name):
            try:
                st = abs_path.stat()
            except OSError:
                continue
            try:
                rel = abs_path.resolve().relative_to(BASE_DIR.resolve()).as_posix()
            except ValueError:
                continue
            items.append(
                {
                    "path": rel,
                    "mtime_ms": int(st.st_mtime * 1000),
                    "size": int(st.st_size),
                    "kind": "file",
                }
            )
    items.sort(key=lambda x: -x["mtime_ms"])
    return items[:limit]


@require_GET
def api_recent(request):
    """
    GET /api/recent?limit=15&dirs=documents1,documents2

    Returns recently modified indexable files (.pdf, .txt) under allowed roots,
    sorted by mtime descending. Short TTL server cache per (dirs, limit) key.
    """
    limit_str = request.GET.get("limit", str(_DEFAULT_LIMIT)).strip()
    try:
        limit = max(1, min(_MAX_LIMIT, int(limit_str)))
    except ValueError:
        return api_error("invalid_limit", "limit must be an integer", 400)

    dirs_raw = request.GET.get("dirs", "").strip()
    directories = _parse_dirs_param(dirs_raw)

    cache_key = f"{limit}|{','.join(sorted(directories))}"
    now = time.monotonic()
    hit = _RECENT_CACHE.get(cache_key)
    if hit is not None and (now - hit[0]) < _RECENT_TTL_SEC:
        payload = hit[1]
    else:
        payload = _collect_recent(directories, limit)
        _RECENT_CACHE[cache_key] = (now, payload)
        if len(_RECENT_CACHE) > 32:
            oldest = min(_RECENT_CACHE.items(), key=lambda kv: kv[1][0])
            del _RECENT_CACHE[oldest[0]]

    return api_ok({"items": payload, "directories": directories})
