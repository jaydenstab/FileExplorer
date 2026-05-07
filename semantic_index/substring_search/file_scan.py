"""
Walk document directories on disk and find files whose contents contain a literal substring.

Unlike semantic search, this does not use ChromaDB or the reranker.

I/O bounds (env): ``PLAINTEXT_SEARCH_MAX_BYTES_PER_FILE`` caps bytes read per ``.txt``;
``PLAINTEXT_SEARCH_MAX_PDF_PAGES`` caps PDF pages scanned per file. Matches beyond those
limits may be missed. For large corpora, a persistent full-text index (FTS5, Tantivy,
etc.) maintained during reindex would replace whole-corpus scans; track as a separate epic.
"""
from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, List, Optional, Set, Union

from semantic_index.document_text import extract_document_text
from semantic_index.indexer import BASE_DIR, list_indexable_files

from .count_matches import count_substring_matches

_DEFAULT_PLAINTEXT_MAX_BYTES = 2 * 1024 * 1024
_DEFAULT_PLAINTEXT_MAX_PDF_PAGES = 10
_DEFAULT_PLAINTEXT_MAX_WORKERS = 4


def _plaintext_max_bytes() -> int:
    return max(4096, int(os.environ.get(
        "PLAINTEXT_SEARCH_MAX_BYTES_PER_FILE",
        str(_DEFAULT_PLAINTEXT_MAX_BYTES),
    )))


def _plaintext_max_pdf_pages() -> int:
    return max(1, int(os.environ.get(
        "PLAINTEXT_SEARCH_MAX_PDF_PAGES",
        str(_DEFAULT_PLAINTEXT_MAX_PDF_PAGES),
    )))


def _plaintext_max_workers() -> int:
    return max(1, int(os.environ.get(
        "PLAINTEXT_SEARCH_MAX_WORKERS",
        str(_DEFAULT_PLAINTEXT_MAX_WORKERS),
    )))


def _relative_project_path(file_path: Path) -> str:
    return str(file_path.resolve().relative_to(BASE_DIR.resolve()))


def _scan_one_file(
    fp: Path,
    query: str,
    *,
    case_sensitive: bool,
    allowed_extensions: Optional[Set[str]],
    max_bytes: int,
    max_pdf_pages: int,
) -> Optional[Dict[str, Union[int, str]]]:
    if allowed_extensions is not None and fp.suffix.lower() not in allowed_extensions:
        return None
    rel = _relative_project_path(fp)
    text = extract_document_text(
        str(fp),
        max_bytes=max_bytes,
        max_pdf_pages=max_pdf_pages,
    )
    n = count_substring_matches(text, query, case_sensitive=case_sensitive)
    if n > 0:
        return {"path": rel, "match_count": int(n)}
    return None


def search_files_plain_text(
    query: str,
    directory: Union[str, List[str]],
    *,
    k: int = 5,
    include_match_counts: bool = False,
    case_sensitive: bool = False,
    allowed_extensions: Optional[Set[str]] = None,
) -> Union[List[str], List[Dict[str, Union[int, str]]]]:
    """
    Return paths (optionally with per-file match counts) for files that contain ``query``.

    Results are sorted by ``match_count`` descending, then path.
    """
    directories = directory if isinstance(directory, list) else [directory]
    max_bytes = _plaintext_max_bytes()
    max_pdf_pages = _plaintext_max_pdf_pages()
    workers = _plaintext_max_workers()

    files: List[Path] = []
    for dir_name in directories:
        for fp in list_indexable_files(dir_name):
            files.append(fp)

    hits: List[Dict[str, Union[int, str]]] = []
    if workers <= 1:
        for fp in files:
            row = _scan_one_file(
                fp,
                query,
                case_sensitive=case_sensitive,
                allowed_extensions=allowed_extensions,
                max_bytes=max_bytes,
                max_pdf_pages=max_pdf_pages,
            )
            if row:
                hits.append(row)
    else:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [
                pool.submit(
                    _scan_one_file,
                    fp,
                    query,
                    case_sensitive=case_sensitive,
                    allowed_extensions=allowed_extensions,
                    max_bytes=max_bytes,
                    max_pdf_pages=max_pdf_pages,
                )
                for fp in files
            ]
            for fut in as_completed(futures):
                row = fut.result()
                if row:
                    hits.append(row)

    hits.sort(key=lambda x: (-int(x["match_count"]), str(x["path"])))
    hits = hits[:k]

    if include_match_counts:
        return hits
    return [str(h["path"]) for h in hits]
