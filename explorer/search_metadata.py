"""Optional filesystem metadata (mtime, size) for search result paths."""
from __future__ import annotations

from typing import Any, List, Union

from .path_policy import resolve_project_relative_path


def enrich_results_with_file_stats(
    items: List[Any],
    *,
    allowed_roots: List[str],
) -> List[Union[dict, str]]:
    """Stat each path under allowed roots; attach mtime_ms and size_bytes. On failure, nulls."""
    out: List[Union[dict, str]] = []
    for item in items:
        if isinstance(item, str):
            path = item
            base: dict = {"path": path}
        elif isinstance(item, dict):
            path = item.get("path")
            if not path:
                out.append(item)
                continue
            base = dict(item)
        else:
            out.append(item)
            continue
        mtime_ms = None
        size_bytes = None
        try:
            p = resolve_project_relative_path(str(path), allowed_roots=allowed_roots)
            if p.is_file():
                st = p.stat()
                mtime_ms = int(st.st_mtime * 1000)
                size_bytes = int(st.st_size)
        except (OSError, ValueError):
            pass
        base["mtime_ms"] = mtime_ms
        base["size_bytes"] = size_bytes
        out.append(base)
    return out
