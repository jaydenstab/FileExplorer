"""
Pure helpers for conditional GET, byte ranges, and Content-Disposition on PDF file responses.

Kept separate from views for unit testing without the Django HTTP stack.
"""
from __future__ import annotations

import os
import re


def file_etag(stat: os.stat_result) -> str:
    """Weak ETag from mtime and size (suitable for large binary bodies)."""
    return f'W/"{stat.st_mtime_ns}-{stat.st_size}"'


def if_none_match_get_matches(header_val: str | None, etag: str) -> bool:
    """
    Whether a GET/HEAD If-None-Match value matches the current entity ETag (304 candidate).

    For safe methods, ``*`` is ignored: RFC 9110 uses ``If-None-Match: *`` mainly for
    state-changing requests; treating ``*`` as matching would incorrectly 304 GETs.
    """
    if not header_val or not etag:
        return False
    for part in header_val.split(","):
        p = part.strip()
        if not p or p == "*":
            continue
        if p == etag:
            return True
        p_norm = p[2:].strip('"') if p.startswith("W/") else p.strip('"')
        e_norm = etag[2:].strip('"') if etag.startswith("W/") else etag.strip('"')
        if p_norm == e_norm:
            return True
    return False


def parse_single_byte_range(range_header: str, file_size: int) -> tuple[int, int] | None:
    """Return inclusive (start, end) or None if not a single satisfiable range."""
    if file_size <= 0 or not range_header.startswith("bytes="):
        return None
    spec = range_header[6:].strip()
    if "," in spec:
        return None
    m = re.match(r"^(\d*)-(\d*)$", spec)
    if not m:
        return None
    a, b = m.group(1), m.group(2)
    if a != "" and b != "":
        start, end = int(a), int(b)
    elif a != "":
        start = int(a)
        end = file_size - 1
    elif b != "":
        suffix = int(b)
        if suffix <= 0:
            return None
        start = max(0, file_size - suffix)
        end = file_size - 1
    else:
        return None
    if start > end or start >= file_size:
        return None
    end = min(end, file_size - 1)
    return start, end


def content_disposition_inline(filename: str) -> str:
    """
    Build a minimal ``Content-Disposition: inline; filename="..."`` value.
    Strips characters that break the quoted-string form.
    """
    safe = (filename or "file").replace('"', "").replace("\r", "").replace("\n", "")
    if not safe.strip():
        safe = "file.pdf"
    return f'inline; filename="{safe}"'
