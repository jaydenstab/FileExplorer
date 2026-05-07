"""
Extract UTF-8 text from workspace documents the indexer supports (.txt, .pdf).

Used by Chroma indexing and by substring (Ctrl+F-style) search over raw files.
"""
from __future__ import annotations

from pathlib import Path

import fitz  # PyMuPDF


def read_txt_file(path: str, *, max_bytes: int | None = None) -> str:
    p = Path(path)
    if max_bytes is None:
        with p.open("r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    with p.open("rb") as f:
        raw = f.read(max_bytes)
    return raw.decode("utf-8", errors="ignore")


def read_pdf_text(path: str, *, max_pages: int | None = None) -> str:
    text = ""
    with fitz.open(path) as pdf:
        total = len(pdf)
        n = total if max_pages is None else min(max_pages, total)
        for i in range(n):
            text += pdf[i].get_text()
    return text


def extract_document_text(
    path: str,
    *,
    max_bytes: int | None = None,
    max_pdf_pages: int | None = None,
) -> str:
    """
    Return text for a supported path; empty string for unknown extensions.

    When ``max_bytes`` is set, only the first that many bytes of a ``.txt`` file are read.
    When ``max_pdf_pages`` is set, only that many PDF pages are scanned (substring search).
    Indexing uses defaults (full file).
    """
    suffix = Path(path).suffix.lower()
    if suffix == ".txt":
        return read_txt_file(path, max_bytes=max_bytes)
    if suffix == ".pdf":
        return read_pdf_text(path, max_pages=max_pdf_pages)
    return ""
