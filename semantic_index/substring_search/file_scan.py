"""
Walk document directories on disk and find files whose contents contain a literal substring.

Unlike semantic search, this does not use ChromaDB or the reranker.
"""
from pathlib import Path
from typing import Dict, List, Optional, Set, Union

from semantic_index.document_text import extract_document_text
from semantic_index.indexer import BASE_DIR, list_indexable_files

from .count_matches import count_substring_matches


def _relative_project_path(file_path: Path) -> str:
    return str(file_path.resolve().relative_to(BASE_DIR.resolve()))


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
    hits: List[Dict[str, Union[int, str]]] = []

    for dir_name in directories:
        for fp in list_indexable_files(dir_name):
            if allowed_extensions is not None and fp.suffix.lower() not in allowed_extensions:
                continue
            rel = _relative_project_path(fp)
            text = extract_document_text(str(fp))
            n = count_substring_matches(text, query, case_sensitive=case_sensitive)
            if n > 0:
                hits.append({"path": rel, "match_count": int(n)})

    hits.sort(key=lambda x: (-int(x["match_count"]), str(x["path"])))
    hits = hits[:k]

    if include_match_counts:
        return hits
    return [str(h["path"]) for h in hits]
