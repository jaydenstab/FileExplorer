"""Filesystem mutations under allowed project roots (rename)."""
from __future__ import annotations

import errno
import json
import logging
import os
import time
from pathlib import Path

from django.db import transaction
from django.db.models import Q
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from semantic_index.chroma_path_rename import ChromaRenameOutcome, rename_path_in_index
from semantic_index.indexer import BASE_DIR, MAX_FILES, count_indexable_files_under, list_indexable_files

from .api_response import api_error, api_ok
from .models import TaggedFile
from .document_roots import get_document_root_dirs, replace_document_root_in_settings
from .path_policy import allowed_search_directories, resolve_project_relative_path

from .file_store import get_library_dirname

logger = logging.getLogger(__name__)


def _same_parent(rel_a: str, rel_b: str) -> bool:
    pa = Path(rel_a).parent.as_posix()
    pb = Path(rel_b).parent.as_posix()
    return pa == pb


def _target_basename_invalid(to_rel: str) -> str | None:
    """Return a short error message if the destination filename is unsafe."""
    name = Path(to_rel).name
    if not name or name in (".", ".."):
        return "Invalid destination name"
    if "\x00" in name or "\x00" in to_rel:
        return "Null bytes are not allowed in paths"
    if "/" in name or "\\" in name:
        return "Destination name cannot contain path separators"
    return None


def _index_consistent_with_disk(outcome: ChromaRenameOutcome) -> bool:
    """
    True when the vector index does not need user action after a successful disk rename.

    - If nothing was indexed for the old path (had_index_rows is False), the index is fine.
    - If rows existed, we require a clean outcome (no warning); partial success with warning is False.
    """
    if outcome.warning is not None:
        return False
    if not outcome.had_index_rows:
        return True
    return outcome.chunks_updated > 0


def _missing_source_details(dst: Path) -> dict | None:
    if dst.is_file() or dst.is_dir():
        return {
            "hint": (
                "Destination already exists. If you are retrying after a timeout, "
                "the rename may have already succeeded."
            )
        }
    return None


def _rewrite_taggedfile_tree_under_library(from_rel: str, to_rel: str) -> None:
    """Update TaggedFile paths when a directory under the library root is renamed."""
    lib = get_library_dirname()
    if not (from_rel == lib or from_rel.startswith(lib + "/")):
        return
    prefix = from_rel + "/"
    with transaction.atomic():
        rows = list(
            TaggedFile.objects.filter(Q(path=from_rel) | Q(path__startswith=prefix)).order_by("path")
        )
        rows.sort(key=lambda tf: len(tf.path), reverse=True)
        for tf in rows:
            tf.path = to_rel + tf.path[len(from_rel) :]
        if rows:
            TaggedFile.objects.bulk_update(rows, ["path"])


def _api_fs_rename_file(from_rel: str, to_rel: str, src: Path, dst: Path) -> dict:
    try:
        os.replace(str(src), str(dst))
    except OSError as e:
        err = getattr(e, "errno", None)
        if err in (errno.EEXIST, errno.ENOTEMPTY):
            return api_error("rename_conflict", str(e), 409)
        return api_error("rename_failed", str(e), 500)

    lib = get_library_dirname()
    if from_rel == lib or from_rel.startswith(lib + "/"):
        TaggedFile.objects.filter(path=from_rel).update(path=to_rel)

    t0 = time.monotonic()
    try:
        outcome = rename_path_in_index(from_rel, to_rel)
    except ValueError as e:
        logger.exception("rename_path_in_index failed after disk rename from=%s to=%s", from_rel, to_rel)
        duration_ms = int((time.monotonic() - t0) * 1000)
        logger.warning(
            "fs_rename index exception from=%s to=%s duration_ms=%s err=%s",
            from_rel,
            to_rel,
            duration_ms,
            e,
        )
        return api_ok(
            {
                "path": to_rel,
                "from": from_rel,
                "chunks_updated": 0,
                "had_index_rows": False,
                "index_updated": False,
                "index_warning": str(e),
            }
        )

    duration_ms = int((time.monotonic() - t0) * 1000)
    logger.info(
        "fs_rename from=%s to=%s chunks_updated=%s had_index=%s index_ok=%s duration_ms=%s",
        from_rel,
        to_rel,
        outcome.chunks_updated,
        outcome.had_index_rows,
        outcome.warning is None,
        duration_ms,
    )

    payload: dict = {
        "path": to_rel,
        "from": from_rel,
        "chunks_updated": outcome.chunks_updated,
        "had_index_rows": outcome.had_index_rows,
        "index_updated": _index_consistent_with_disk(outcome),
    }
    if outcome.warning:
        payload["index_warning"] = outcome.warning

    return api_ok(payload)


def _api_fs_rename_directory(from_rel: str, to_rel: str, src: Path, dst: Path) -> dict:
    raw_src = BASE_DIR / Path(from_rel).as_posix()
    if raw_src.is_symlink():
        return api_error("invalid_rename", "Renaming a directory symlink is not supported", 400)

    n_indexable = count_indexable_files_under(from_rel)
    if n_indexable > MAX_FILES:
        return api_error(
            "too_many_files",
            f"Folder contains more than {MAX_FILES} indexable files; rename is not supported. "
            "Split the tree or run Reindex after a manual move.",
            413,
        )

    paths_abs = list_indexable_files(from_rel)
    old_paths = [p.resolve().relative_to(BASE_DIR.resolve()).as_posix() for p in paths_abs]

    try:
        src.rename(dst)
    except OSError as e:
        err = getattr(e, "errno", None)
        if err in (errno.EEXIST, errno.ENOTEMPTY):
            return api_error("rename_conflict", str(e), 409)
        return api_error("rename_failed", str(e), 500)

    doc_roots = get_document_root_dirs()
    if from_rel in doc_roots and "/" not in from_rel and "/" not in to_rel:
        replace_document_root_in_settings(from_rel, to_rel)

    _rewrite_taggedfile_tree_under_library(from_rel, to_rel)

    total_chunks = 0
    any_had_rows = False
    all_consistent = True
    first_warning: str | None = None
    failed_old: str | None = None

    t0 = time.monotonic()
    for old_rel in old_paths:
        new_rel = to_rel + old_rel[len(from_rel) :]
        try:
            outcome = rename_path_in_index(old_rel, new_rel)
        except ValueError as e:
            logger.exception(
                "rename_path_in_index failed after dir rename from=%s to=%s at old=%s",
                from_rel,
                to_rel,
                old_rel,
            )
            first_warning = str(e)
            failed_old = old_rel
            all_consistent = False
            break

        total_chunks += outcome.chunks_updated
        if outcome.had_index_rows:
            any_had_rows = True
        if not _index_consistent_with_disk(outcome):
            all_consistent = False
            first_warning = outcome.warning or (
                "Search index could not be fully updated for this folder. Try Reindex files."
            )
            failed_old = old_rel
            break

    duration_ms = int((time.monotonic() - t0) * 1000)
    logger.info(
        "fs_rename_dir from=%s to=%s files=%s chunks_updated=%s had_index=%s index_ok=%s duration_ms=%s",
        from_rel,
        to_rel,
        len(old_paths),
        total_chunks,
        any_had_rows,
        all_consistent,
        duration_ms,
    )

    payload: dict = {
        "path": to_rel,
        "from": from_rel,
        "chunks_updated": total_chunks,
        "had_index_rows": any_had_rows,
        "index_updated": all_consistent,
        "files_index_migrated": len(old_paths),
    }
    if first_warning:
        payload["index_warning"] = first_warning
        if failed_old:
            logger.warning("fs_rename_dir index stopped at old_path=%s", failed_old)

    return api_ok(payload)


@csrf_exempt
@require_http_methods(["POST"])
def api_fs_rename(request):
    """
    Rename a file or directory under an allowed root; same parent directory only.

    JSON body: {"from": "documents1/a.txt", "to": "documents1/b.txt"}

    Directories: renames on disk, migrates ``TaggedFile`` rows under the library root when
    applicable, then updates Chroma for each indexable PDF/TXT under the tree (same rules as
    indexing). Folders with more than ``MAX_FILES`` (200) indexable files return 413 before
    any disk change.

    Response fields (200):

    - ``path``, ``from`` (optional): resulting and previous relative paths.
    - ``chunks_updated``: Chroma chunk rows written (file: one path; directory: sum over files).
    - ``had_index_rows``: whether Chroma had rows for any migrated path before the index step.
    - ``index_updated``: True when the search index is consistent with the rename.
    - ``index_warning`` (optional): hint when the path moved on disk but the vector index
      could not be fully updated.
    - ``files_index_migrated`` (optional): number of indexable files processed (directory rename).

    Disk: files use ``os.replace``; directories use ``Path.rename``. ``index_updated`` can be
    true with ``chunks_updated`` 0 when nothing was present in Chroma.
    """
    try:
        body = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return api_error("invalid_json", "Request body must be JSON", 400)

    from_rel = (body.get("from") or "").strip()
    to_rel = (body.get("to") or "").strip()
    if not from_rel or not to_rel:
        return api_error("missing_paths", "from and to are required", 400)

    roots = allowed_search_directories()
    lib = get_library_dirname()
    doc_roots = get_document_root_dirs()
    roots_for_dst = list(roots)
    if "/" not in from_rel and "/" not in to_rel:
        if to_rel not in roots_for_dst and to_rel != lib:
            roots_for_dst.append(to_rel)

    if "/" not in from_rel and from_rel in doc_roots:
        if "/" in to_rel:
            return api_error(
                "invalid_rename",
                "Renaming a document root must use a single destination folder name",
                400,
            )
        if to_rel == lib:
            return api_error(
                "invalid_rename",
                "Destination name cannot match the library folder",
                400,
            )
        if to_rel in doc_roots and to_rel != from_rel:
            return api_error("target_exists", "A document root with that name already exists", 409)

    try:
        src = resolve_project_relative_path(from_rel, allowed_roots=roots)
        dst = resolve_project_relative_path(to_rel, allowed_roots=roots_for_dst)
    except ValueError as e:
        return api_error("path_forbidden", str(e), 403)

    bad = _target_basename_invalid(to_rel)
    if bad:
        return api_error("invalid_destination_name", bad, 400)

    if not src.exists():
        return api_error(
            "source_not_found",
            "Source not found",
            404,
            details=_missing_source_details(dst),
        )

    if dst.exists():
        return api_error("target_exists", "Target path already exists", 409)
    if not _same_parent(from_rel, to_rel):
        return api_error("invalid_rename", "from and to must share the same parent folder", 400)
    if src.resolve() == dst.resolve():
        return api_ok(
            {
                "path": to_rel,
                "message": "noop",
                "chunks_updated": 0,
                "had_index_rows": False,
                "index_updated": True,
            }
        )

    if src.is_file():
        return _api_fs_rename_file(from_rel, to_rel, src, dst)
    if src.is_dir():
        return _api_fs_rename_directory(from_rel, to_rel, src, dst)

    return api_error("source_not_found", "Source not found", 404, details=_missing_source_details(dst))
