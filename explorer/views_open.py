"""
File opening API views - handles opening files via OS or returning preview content.
"""
from django.http import JsonResponse, FileResponse
from django.views.decorators.http import require_GET
from django.views.decorators.clickjacking import xframe_options_exempt
import subprocess
import sys
import os
import time
import logging
from pathlib import Path
import fitz  # PyMuPDF
from .api_response import api_error, api_ok
from .path_policy import ALLOWED_DOCUMENT_DIRECTORIES, resolve_project_relative_path

# Configuration
MAX_PREVIEW_SIZE = 5 * 1024 * 1024 
OPEN_OS_TIMEOUT_SECONDS = 8
logger = logging.getLogger(__name__)


def _read_text_file_preview(path: Path) -> dict:
    """Read text file and return preview content."""
    try:
        with path.open("r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        return {
            "type": "text",
            "content": content,
            "size": len(content.encode("utf-8")),
        }
    except Exception as e:
        return {"error": f"Failed to read file: {str(e)}"}


def _read_pdf_preview(path: Path) -> dict:
    """Extract text from PDF and return preview content."""
    try:
        text = ""
        with fitz.open(str(path)) as pdf:
            total_pages = len(pdf)
            # Limit to first 10 pages for preview
            for page_num in range(min(10, total_pages)):
                text += pdf[page_num].get_text()
        return {
            "type": "pdf",
            "content": text,
            "pages": total_pages,
            "preview_pages": min(10, total_pages),
        }
    except Exception as e:
        return {"error": f"Failed to read PDF: {str(e)}"}


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
    
    # Validate path is safe
    try:
        full_path = resolve_project_relative_path(
            file_path, allowed_roots=ALLOWED_DOCUMENT_DIRECTORIES
        )
    except ValueError:
        return api_error("path_forbidden", "Invalid or unauthorized file path", 403)
    
    # Check if file exists
    if not full_path.exists() or not full_path.is_file():
        return api_error("file_not_found", "File not found", 404)
    
    # Handle preview mode
    if mode == "preview":
        # Check file size
        file_size = full_path.stat().st_size
        if file_size > MAX_PREVIEW_SIZE:
            return api_error(
                "preview_too_large",
                f"File too large for preview (max {MAX_PREVIEW_SIZE / 1024 / 1024:.1f}MB)",
                413,
                details={"size": file_size},
            )
        
        # Determine file type and read accordingly
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
    
    # Handle open_os mode
    elif mode == "open_os":
        try:
            # Cross-platform file opening
            if sys.platform == "win32":
                # Windows
                os.startfile(str(full_path))
            elif sys.platform == "darwin":
                # macOS
                subprocess.run(["open", str(full_path)], check=True, timeout=OPEN_OS_TIMEOUT_SECONDS)
            else:
                # Linux and other Unix-like systems
                subprocess.run(["xdg-open", str(full_path)], check=True, timeout=OPEN_OS_TIMEOUT_SECONDS)
            
            return JsonResponse({
                "success": True,
                "message": "File opened successfully",
                "path": file_path,
            })
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
    
    else:
        return api_error(
            "invalid_mode", f"Invalid mode: {mode}. Use 'preview' or 'open_os'", 400
        )


@xframe_options_exempt
@require_GET
def api_file(request):
    """
    Serve a file for inline embedding (e.g. PDF in iframe).
    Only PDFs are supported. Uses same path validation as api_open.
    """
    started = time.monotonic()
    file_path = request.GET.get("path", "").strip()
    if not file_path:
        return api_error("missing_path", "missing 'path' parameter", 400)

    try:
        full_path = resolve_project_relative_path(
            file_path, allowed_roots=ALLOWED_DOCUMENT_DIRECTORIES
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

    response = FileResponse(
        open(full_path, "rb"),
        content_type="application/pdf",
        as_attachment=False,
    )
    response["Content-Disposition"] = "inline; filename=\"" + full_path.name + "\""
    logger.info(
        "api_file.success",
        extra={
            "path": file_path,
            "elapsed_ms": int((time.monotonic() - started) * 1000),
        },
    )
    return response

