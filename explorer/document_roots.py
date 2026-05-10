"""Persisted document root directory names (e.g. documents1) for search and path policy."""
from __future__ import annotations

import logging
from functools import lru_cache

from django.db import transaction

logger = logging.getLogger(__name__)

SETTINGS_PK = "default"
DEFAULT_DOCUMENT_ROOT_DIRS = ["documents1", "documents2"]


@lru_cache(maxsize=1)
def _cached_document_root_dirs() -> tuple[str, ...]:
    from django.db import DatabaseError

    from .models import ExplorerSettings

    try:
        row = ExplorerSettings.objects.filter(key=SETTINGS_PK).first()
    except DatabaseError as exc:
        logger.warning(
            "ExplorerSettings unavailable; using default document roots: %s",
            exc,
        )
        return tuple(DEFAULT_DOCUMENT_ROOT_DIRS)
    if row is None:
        return tuple(DEFAULT_DOCUMENT_ROOT_DIRS)
    raw = row.document_root_dirs
    if not isinstance(raw, list) or not raw:
        return tuple(DEFAULT_DOCUMENT_ROOT_DIRS)
    out: list[str] = []
    for x in raw:
        s = str(x).strip().strip("/")
        if s and s not in out and ".." not in s and "/" not in s:
            out.append(s)
    return tuple(out) if out else tuple(DEFAULT_DOCUMENT_ROOT_DIRS)


def invalidate_document_root_dirs_cache() -> None:
    _cached_document_root_dirs.cache_clear()


def get_document_root_dirs() -> list[str]:
    """Top-level document directories under the project root (search/reindex scope, excluding library)."""
    return list(_cached_document_root_dirs())


def _set_document_root_dirs_raw(dirs: list[str]) -> None:
    from .models import ExplorerSettings

    with transaction.atomic():
        ExplorerSettings.objects.update_or_create(
            key=SETTINGS_PK,
            defaults={"document_root_dirs": dirs},
        )
    invalidate_document_root_dirs_cache()


def replace_document_root_in_settings(old_name: str, new_name: str) -> None:
    """Swap ``old_name`` for ``new_name`` in persisted roots (order preserved)."""
    dirs = get_document_root_dirs()
    if old_name not in dirs:
        return
    new_dirs: list[str] = []
    for d in dirs:
        new_dirs.append(new_name if d == old_name else d)
    _set_document_root_dirs_raw(new_dirs)
    logger.info("document_root_dirs updated: %s -> %s (now %s)", old_name, new_name, new_dirs)
