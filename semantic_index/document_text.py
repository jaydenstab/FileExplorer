"""
Extract UTF-8 text from workspace documents the indexer supports (.txt, .pdf).

Used by Chroma indexing and by substring (Ctrl+F-style) search over raw files.
"""
from pathlib import Path

import fitz  # PyMuPDF


def read_txt_file(path: str) -> str:
    p = Path(path)
    with p.open("r", encoding="utf-8", errors="ignore") as f:
        return f.read()


def read_pdf_text(path: str) -> str:
    text = ""
    with fitz.open(path) as pdf:
        for page in pdf:
            text += page.get_text()
    return text


def extract_document_text(path: str) -> str:
    """Return full text for a supported path; empty string for unknown extensions."""
    suffix = Path(path).suffix.lower()
    if suffix == ".txt":
        return read_txt_file(path)
    if suffix == ".pdf":
        return read_pdf_text(path)
    return ""
