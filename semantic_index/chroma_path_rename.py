"""Update Chroma chunk rows when a file path is renamed (same root directory)."""
from __future__ import annotations

import logging
from typing import NamedTuple

import chromadb

from .indexer import CHROMA_DIR

logger = logging.getLogger(__name__)

_CHROMA_GET_INCLUDES = ["embeddings", "documents", "metadatas"]


class ChromaRenameOutcome(NamedTuple):
    """Result of attempting to move all chunks from old_rel to new_rel."""

    chunks_updated: int
    """Number of chunk rows written under new_rel (0 if add did not complete)."""
    warning: str | None
    """Set when chunks could not be fully reconciled; user may need Reindex."""
    had_index_rows: bool
    """True if Chroma had at least one chunk row for old_rel (migration was attempted or needed)."""


def _normalize_embedding_row(row: object) -> list[float]:
    if hasattr(row, "tolist"):
        out = row.tolist()  # type: ignore[no-untyped-call]
        if isinstance(out, (int, float)):
            return [float(out)]
        if isinstance(out, list):
            return [float(x) for x in out]
    if isinstance(row, (list, tuple)):
        return [float(x) for x in row]
    raise TypeError("unexpected embedding row type")


def rename_path_in_index(old_rel: str, new_rel: str) -> ChromaRenameOutcome:
    """
    Move all chunks from old_rel to new_rel in the per-root Chroma collection.

    Uses **add-then-delete**: new rows are inserted first so a failure during ``add``
    does not leave the index empty while the file already moved on disk.

    Chroma's collection.get() omits embeddings unless explicitly requested.
    """
    old_parts = old_rel.split("/")
    new_parts = new_rel.split("/")
    if len(old_parts) < 2 or len(new_parts) < 2:
        return ChromaRenameOutcome(0, None, False)
    root = old_parts[0]
    if new_parts[0] != root:
        raise ValueError("rename must stay under the same root directory")

    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    collection_name = f"files_{root}"
    try:
        col = client.get_collection(collection_name)
    except Exception:
        return ChromaRenameOutcome(0, None, False)

    try:
        got = col.get(where={"path": old_rel}, include=_CHROMA_GET_INCLUDES)  # type: ignore[arg-type]
    except Exception as e:
        logger.warning("chroma rename get failed path=%s: %s", old_rel, e, exc_info=True)
        return ChromaRenameOutcome(
            0,
            "Search index could not be read. Try Reindex files.",
            False,
        )

    ids = got.get("ids") or []
    if not ids:
        return ChromaRenameOutcome(0, None, False)

    documents_raw = got.get("documents")
    embeddings = got.get("embeddings")
    metadatas_raw = got.get("metadatas") or []

    if embeddings is None:
        logger.warning(
            "chroma rename skipped: no embeddings in get() for path=%s (check include=)",
            old_rel,
        )
        return ChromaRenameOutcome(
            0,
            "Search index still lists the old path. Click Reindex files or try again.",
            True,
        )

    if len(embeddings) != len(ids):
        logger.warning(
            "chroma rename skipped: embedding count mismatch path=%s ids=%s emb=%s",
            old_rel,
            len(ids),
            len(embeddings),
        )
        return ChromaRenameOutcome(
            0,
            "Search index could not be updated (internal mismatch). Try Reindex files.",
            True,
        )

    documents: list[str] = []
    if documents_raw is None:
        documents = [""] * len(ids)
    elif len(documents_raw) != len(ids):
        logger.warning(
            "chroma rename: document count mismatch path=%s; padding",
            old_rel,
        )
        documents = [
            str(documents_raw[i]) if i < len(documents_raw) else ""
            for i in range(len(ids))
        ]
    else:
        documents = [str(d) for d in documents_raw]

    metadatas = [dict(m) for m in metadatas_raw if isinstance(m, dict)]
    while len(metadatas) < len(ids):
        metadatas.append({})
    metadatas = metadatas[: len(ids)]

    try:
        emb_rows = [_normalize_embedding_row(e) for e in embeddings]
    except (TypeError, ValueError) as e:
        logger.warning("chroma rename skipped: bad embedding rows path=%s err=%s", old_rel, e)
        return ChromaRenameOutcome(
            0,
            "Search index could not be updated. Try Reindex files.",
            True,
        )

    new_ids: list[str] = []
    new_metas: list[dict] = []
    for i, mid in enumerate(ids):
        meta = metadatas[i] if i < len(metadatas) else {}
        chunk = meta.get("chunk", i)
        meta = {**meta, "path": new_rel}
        new_ids.append(f"{new_rel}::chunk-{chunk}")
        new_metas.append(meta)

    try:
        col.add(
            ids=new_ids,
            embeddings=emb_rows,
            documents=documents,
            metadatas=new_metas,
        )
    except Exception as add_err:
        logger.warning(
            "chroma rename: add failed path=%s -> %s: %s",
            old_rel,
            new_rel,
            add_err,
            exc_info=True,
        )
        return ChromaRenameOutcome(
            0,
            "Search index could not be updated. Try Reindex files.",
            True,
        )

    try:
        col.delete(ids=list(ids))
    except Exception as del_err:
        logger.warning(
            "chroma rename: delete old ids failed after add path=%s -> %s: %s",
            old_rel,
            new_rel,
            del_err,
            exc_info=True,
        )
        return ChromaRenameOutcome(
            len(new_ids),
            "Search index may list both old and new paths until you Reindex files.",
            True,
        )

    return ChromaRenameOutcome(len(new_ids), None, True)
