"""
File opening API views - handles opening files via OS or returning preview content.
"""
from __future__ import annotations

import logging
import os
import subprocess
import sys
import time
from pathlib import Path

from django.http import FileResponse, HttpResponse, HttpResponseNotModified, StreamingHttpResponse
from django.utils.http import http_date
from django.views.decorators.clickjacking import xframe_options_exempt
from django.views.decorators.http import require_GET
from pypdf import PdfReader

from .api_response import api_error, api_ok
from .path_policy import get_document_root_dirs, resolve_project_relative_path
from .pdf_http import (
    content_disposition_inline,
    file_etag,
    if_none_match_get_matches,
    parse_single_byte_range,
)

# Configuration: reject preview if the file on disk exceeds this size.
MAX_PREVIEW_FILE_BYTES = 5 * 1024 * 1024
# Max bytes loaded into memory for a text preview (defaults to same cap; tests may patch lower).
MAX_TEXT_PREVIEW_READ_BYTES = MAX_PREVIEW_FILE_BYTES
OPEN_OS_TIMEOUT_SECONDS = 8
API_FILE_MAX_AGE_SECONDS = int(os.environ.get("API_FILE_MAX_AGE_SECONDS", "120"))
logger = logging.getLogger(__name__)


def _read_text_file_preview(path: Path) -> dict:
    """Read text preview up to MAX_TEXT_PREVIEW_READ_BYTES (no full-file read for huge files)."""
    try:
        st = path.stat()
        read_len = min(MAX_TEXT_PREVIEW_READ_BYTES, st.st_size)
        with path.open("rb") as f:
            raw = f.read(read_len)
        content = raw.decode("utf-8", errors="ignore")
        return {
            "type": "text",
            "content": content,
            "size": st.st_size,
        }
    except Exception as e:
        return {"error": f"Failed to read file: {str(e)}"}


def _read_pdf_preview(path: Path) -> dict:
    """Return PDF metadata only (page count via pypdf); client renders via /api/file + pdf.js."""
    try:
        with path.open("rb") as f:
            reader = PdfReader(f)
            total_pages = len(reader.pages)
        preview_pages = min(10, total_pages)
        return {
            "type": "pdf",
            "content": "",
            "pages": total_pages,
            "preview_pages": preview_pages,
        }
    except Exception as e:
        return {"error": f"Failed to read PDF: {str(e)}"}


def _range_not_satisfiable(file_size: int) -> HttpResponse:
    r = HttpResponse(status=416, content_type="application/pdf")
    r["Content-Range"] = f"bytes */{file_size}"
    r["Accept-Ranges"] = "bytes"
    return r


@require_GET
def api_open(request):
    """
    Open a file via OS default application or return preview content.

    Query parameters:
    - path (required): Relative file path from project root (e.g., "documents1/file.pdf")
    - mode (optional): "preview" to return content, "open_os" to open with OS app (default: "preview")

    Returns JSON with file content/metadata for preview mode, or success/error for open_os mode.
    """
    started = time.monotonic()
    file_path = request.GET.get("path", "").strip()
    mode = request.GET.get("mode", "preview").strip().lower()

    if not file_path:
        return api_error("missing_path", "missing 'path' parameter", 400)

    try:
        full_path = resolve_project_relative_path(
            file_path, allowed_roots=get_document_root_dirs()
        )
    except ValueError:
        return api_error("path_forbidden", "Invalid or unauthorized file path", 403)

    if not full_path.exists() or not full_path.is_file():
        return api_error("file_not_found", "File not found", 404)

    if mode == "preview":
        file_size = full_path.stat().st_size
        if file_size > MAX_PREVIEW_FILE_BYTES:
            return api_error(
                "preview_too_large",
                f"File too large for preview (max {MAX_PREVIEW_FILE_BYTES / 1024 / 1024:.1f}MB)",
                413,
                details={"size": file_size},
            )

        suffix = full_path.suffix.lower()
        if suffix == ".txt":
            result = _read_text_file_preview(full_path)
        elif suffix == ".pdf":
            result = _read_pdf_preview(full_path)
        else:
            return api_error("unsupported_file_type", f"Unsupported file type: {suffix}", 400)

        if "error" in result:
            return api_error("preview_read_failed", result["error"], 500)

        result["path"] = file_path
        result["name"] = full_path.name
        response = api_ok(result)
        logger.info(
            "api_open.preview.success",
            extra={
                "path": file_path,
                "suffix": suffix,
                "elapsed_ms": int((time.monotonic() - started) * 1000),
            },
        )
        return response

    if mode == "open_os":
        try:
            if sys.platform == "win32":
                os.startfile(str(full_path))
            elif sys.platform == "darwin":
                subprocess.run(["open", str(full_path)], check=True, timeout=OPEN_OS_TIMEOUT_SECONDS)
            else:
                subprocess.run(
                    ["xdg-open", str(full_path)], check=True, timeout=OPEN_OS_TIMEOUT_SECONDS
                )

            return api_ok(
                {
                    "success": True,
                    "message": "File opened successfully",
                    "path": file_path,
                }
            )
        except subprocess.TimeoutExpired:
            return api_error(
                "open_timeout",
                "Timed out while opening file with system application",
                504,
                details={"path": file_path},
            )
        except subprocess.CalledProcessError as e:
            return api_error(
                "open_failed",
                f"Failed to open file: {str(e)}",
                500,
                details={"path": file_path},
            )
        except Exception as e:
            return api_error(
                "open_unexpected",
                f"Unexpected error: {str(e)}",
                500,
                details={"path": file_path},
            )

    return api_error(
        "invalid_mode", f"Invalid mode: {mode}. Use 'preview' or 'open_os'", 400
    )


@xframe_options_exempt
@require_GET
def api_file(request):
    """
    Serve a file for inline embedding (e.g. PDF in iframe).
    Only PDFs are supported. Uses same path validation as api_open.
    Supports conditional GET (ETag / Last-Modified), Cache-Control, and single-byte Range (206).
    """
    started = time.monotonic()
    file_path = request.GET.get("path", "").strip()
    if not file_path:
        return api_error("missing_path", "missing 'path' parameter", 400)

    try:
        full_path = resolve_project_relative_path(
            file_path, allowed_roots=get_document_root_dirs()
        )
    except ValueError:
        return api_error("path_forbidden", "Invalid or unauthorized file path", 403)

    if not full_path.exists() or not full_path.is_file():
        return api_error("file_not_found", "File not found", 404)

    if full_path.suffix.lower() != ".pdf":
        return api_error(
            "unsupported_embed_type",
            "Only PDF files can be served for embedding",
            400,
        )

    stat = full_path.stat()
    size = stat.st_size
    etag = file_etag(stat)
    mtime = stat.st_mtime
    cache_control = f"private, max-age={API_FILE_MAX_AGE_SECONDS}"

    if if_none_match_get_matches(request.META.get("HTTP_IF_NONE_MATCH"), etag):
        r = HttpResponseNotModified()
        r["ETag"] = etag
        r["Cache-Control"] = cache_control
        r["Last-Modified"] = http_date(mtime)
        r["Accept-Ranges"] = "bytes"
        logger.info(
            "api_file",
            extra={
                "path": file_path,
                "http_status": 304,
                "elapsed_ms": int((time.monotonic() - started) * 1000),
            },
        )
        return r

    range_header = (request.META.get("HTTP_RANGE") or "").strip()
    disposition = content_disposition_inline(full_path.name)

    if range_header.startswith("bytes=") and size > 0:
        parsed = parse_single_byte_range(range_header, size)
        if parsed is None:
            resp416 = _range_not_satisfiable(size)
            logger.info(
                "api_file",
                extra={
                    "path": file_path,
                    "http_status": 416,
                    "elapsed_ms": int((time.monotonic() - started) * 1000),
                },
            )
            return resp416
        start, end = parsed
        length = end - start + 1

        def byte_iterator():
            with full_path.open("rb") as f:
                f.seek(start)
                remaining = length
                while remaining > 0:
                    chunk = f.read(min(65536, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        resp = StreamingHttpResponse(byte_iterator(), status=206, content_type="application/pdf")
        resp["Content-Range"] = f"bytes {start}-{end}/{size}"
        resp["Content-Length"] = str(length)
        resp["Content-Disposition"] = disposition
        resp["Accept-Ranges"] = "bytes"
        resp["ETag"] = etag
        resp["Cache-Control"] = cache_control
        resp["Last-Modified"] = http_date(mtime)
        logger.info(
            "api_file",
            extra={
                "path": file_path,
                "http_status": 206,
                "elapsed_ms": int((time.monotonic() - started) * 1000),
            },
        )
        return resp

    resp = FileResponse(
        full_path.open("rb"),
        content_type="application/pdf",
        as_attachment=False,
    )
    resp["Content-Disposition"] = disposition
    resp["Accept-Ranges"] = "bytes"
    resp["ETag"] = etag
    resp["Cache-Control"] = cache_control
    resp["Last-Modified"] = http_date(mtime)
    logger.info(
        "api_file",
        extra={
            "path": file_path,
            "http_status": 200,
            "elapsed_ms": int((time.monotonic() - started) * 1000),
        },
    )
    return resp
