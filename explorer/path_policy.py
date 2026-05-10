"""Shared path and directory validation policy."""
from __future__ import annotations

from pathlib import Path

from semantic_index.indexer import BASE_DIR

from .document_roots import get_document_root_dirs
from .file_store import get_library_dirname, get_library_root

MAX_PATH_LENGTH = 1024


def allowed_search_directories() -> list[str]:
    # Keep search/reindex strict to indexable roots.
    return [*get_document_root_dirs(), get_library_dirname()]


def normalize_directory(directory: str) -> str:
    value = (directory or "").strip()
    if not value:
        raise ValueError("directory name cannot be empty")
    roots = allowed_search_directories()
    if value not in roots:
        raise ValueError(f"directory must be one of: {', '.join(roots)}")
    return value


def resolve_project_relative_path(
    file_path: str, *, allowed_roots: list[str] | None = None
) -> Path:
    allowed_roots = allowed_roots or get_document_root_dirs()
    if not file_path or len(file_path) > MAX_PATH_LENGTH:
        raise ValueError("invalid path")
    if "\x00" in file_path:
        raise ValueError("invalid path")

    normalized = Path(file_path).as_posix()
    if ".." in normalized or normalized.startswith("/"):
        raise ValueError("invalid path")

    for root in allowed_roots:
        if normalized == root or normalized.startswith(root + "/"):
            full_path = BASE_DIR / normalized
            root_path = (BASE_DIR / root).resolve()
            resolved = full_path.resolve()
            root_str = str(root_path)
            resolved_str = str(resolved)
            if resolved_str == root_str or resolved_str.startswith(root_str + "/"):
                return resolved
    raise ValueError("path outside allowed roots")


def validate_library_relative_path(path: str) -> str:
    raw = (path or "").strip()
    if not raw:
        raise ValueError("missing path")
    p = Path(raw)
    if p.is_absolute():
        raise ValueError("path must be project-relative")
    lib = get_library_dirname()
    norm = p.as_posix().lstrip("/")
    if not (norm == lib or norm.startswith(lib + "/")):
        raise ValueError(f"path must be under {lib}/")
    full = (BASE_DIR / norm).resolve()
    lib_root = get_library_root().resolve()
    if lib_root not in full.parents and full != lib_root:
        raise ValueError("invalid path")
    if not full.is_file():
        raise ValueError("file not found")
    return norm
