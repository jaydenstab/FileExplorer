"""Store user-added files under a project-local library dir (default ``indexed_files/``)."""
from __future__ import annotations

import os
import re
import shutil
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional, Set, Tuple

from semantic_index.indexer import BASE_DIR, get_supported_exts

DEFAULT_LIBRARY_DIRNAME = "indexed_files"
_FILENAME_SAFE = re.compile(r"[^A-Za-z0-9._ -]+")


def get_library_root() -> Path:
    name = os.getenv("FILE_LIBRARY_DIR", DEFAULT_LIBRARY_DIRNAME).strip() or DEFAULT_LIBRARY_DIRNAME
    root = (BASE_DIR / name).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def get_library_dirname() -> str:
    return str(get_library_root().relative_to(BASE_DIR.resolve()))


def _sanitize_filename(name: str) -> str:
    name = (name or "").strip().replace("/", "_").replace("\\", "_")
    name = _FILENAME_SAFE.sub("_", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name or "file"


def _safe_subdir(subdir: Optional[str]) -> str:
    if not subdir:
        return ""
    raw = Path(subdir).as_posix().strip().strip("/")
    if not raw:
        return ""
    parts = [p for p in raw.split("/") if p and p not in (".", "..")]
    return "/".join(parts)


def _relpath(p: Path) -> str:
    return str(p.resolve().relative_to(BASE_DIR.resolve()))


@dataclass(frozen=True)
class StoredFile:
    path: str
    name: str
    size_bytes: int
    ext: str


def list_library_files(*, allowed_extensions: Optional[Set[str]] = None) -> List[StoredFile]:
    root = get_library_root()
    allow = allowed_extensions if allowed_extensions is not None else get_supported_exts()
    out: List[StoredFile] = []
    for ext in allow:
        for fp in root.rglob(f"*{ext}"):
            try:
                if not fp.is_file():
                    continue
                st = fp.stat()
            except OSError:
                continue
            out.append(
                StoredFile(path=_relpath(fp), name=fp.name, size_bytes=int(st.st_size), ext=fp.suffix.lower())
            )
    out.sort(key=lambda x: x.path)
    return out


def store_uploaded_file(*, upload, subdir: Optional[str] = None) -> StoredFile:
    supported = get_supported_exts()
    safe_name = _sanitize_filename(getattr(upload, "name", "") or "file")
    ext = Path(safe_name).suffix.lower()
    if ext not in supported:
        raise ValueError(f"unsupported file type: {ext or '(no extension)'}")

    root = get_library_root()
    rel_sub = _safe_subdir(subdir)
    target_dir = (root / rel_sub).resolve()
    if root.resolve() not in target_dir.parents and target_dir != root.resolve():
        raise ValueError("invalid subdir")
    target_dir.mkdir(parents=True, exist_ok=True)

    stem = Path(safe_name).stem or "file"
    dest = target_dir / f"{stem}-{uuid.uuid4().hex[:10]}{ext}"
    with dest.open("wb") as f:
        for chunk in upload.chunks():
            f.write(chunk)
    st = dest.stat()
    return StoredFile(path=_relpath(dest), name=dest.name, size_bytes=int(st.st_size), ext=ext)


def import_local_paths(paths: Iterable[str], *, subdir: Optional[str] = None) -> Tuple[List[StoredFile], List[dict]]:
    supported = get_supported_exts()
    root = get_library_root()
    rel_sub = _safe_subdir(subdir)
    target_dir = (root / rel_sub).resolve()
    if root.resolve() not in target_dir.parents and target_dir != root.resolve():
        raise ValueError("invalid subdir")
    target_dir.mkdir(parents=True, exist_ok=True)

    imported: List[StoredFile] = []
    errors: List[dict] = []
    for raw in paths:
        try:
            if not str(raw).strip():
                continue
            src = Path(str(raw)).expanduser().resolve()
            if not src.is_file():
                errors.append({"path": str(raw), "error": "not a file"})
                continue
            ext = src.suffix.lower()
            if ext not in supported:
                errors.append({"path": str(raw), "error": f"unsupported type: {ext}"})
                continue
            stem = _sanitize_filename(src.stem)
            dest = target_dir / f"{stem or 'file'}-{uuid.uuid4().hex[:10]}{ext}"
            shutil.copy2(str(src), str(dest))
            st = dest.stat()
            imported.append(StoredFile(path=_relpath(dest), name=dest.name, size_bytes=int(st.st_size), ext=ext))
        except Exception as e:
            errors.append({"path": str(raw), "error": str(e)})
    imported.sort(key=lambda x: x.path)
    return imported, errors
