"""
File opening API views - handles opening files via OS or returning preview content.
"""
from django.http import JsonResponse, HttpResponse, FileResponse
from django.views.decorators.http import require_GET
from pathlib import Path
import subprocess
import sys
import os
import fitz  # PyMuPDF

# Configuration - allowed document directories
BASE_DIR = Path(__file__).resolve().parents[1]
ALLOWED_DIRECTORIES = ["documents1", "documents2"]
MAX_PREVIEW_SIZE = 5 * 1024 * 1024  # 5MB max for preview


def _is_safe_path(file_path: str) -> tuple[bool, Path | None]:
    """
    Validate that the requested file path is within allowed document directories.
    
    Args:
        file_path: Relative path from project root (e.g., "documents1/file.pdf")
    
    Returns:
        Tuple of (is_safe, absolute_path) where absolute_path is None if not safe
    """
    # Normalize the path
    normalized = Path(file_path).as_posix()  # Use forward slashes
    
    # Check if path starts with any allowed directory
    for allowed_dir in ALLOWED_DIRECTORIES:
        if normalized.startswith(allowed_dir + "/") or normalized == allowed_dir:
            full_path = BASE_DIR / normalized
            # Ensure the resolved path is still within BASE_DIR (prevent directory traversal)
            try:
                resolved = full_path.resolve()
                if BASE_DIR.resolve() in resolved.parents or resolved == BASE_DIR.resolve():
                    return True, resolved
            except (OSError, ValueError):
                pass
    
    return False, None


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
            # Limit to first 10 pages for preview
            for page_num in range(min(10, len(pdf))):
                text += pdf[page_num].get_text()
        return {
            "type": "pdf",
            "content": text,
            "pages": len(pdf),
            "preview_pages": min(10, len(pdf)),
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
    file_path = request.GET.get("path", "").strip()
    mode = request.GET.get("mode", "preview").strip().lower()
    
    if not file_path:
        return JsonResponse({"error": "missing 'path' parameter"}, status=400)
    
    # Validate path is safe
    is_safe, full_path = _is_safe_path(file_path)
    if not is_safe or full_path is None:
        return JsonResponse({"error": "Invalid or unauthorized file path"}, status=403)
    
    # Check if file exists
    if not full_path.exists() or not full_path.is_file():
        return JsonResponse({"error": "File not found"}, status=404)
    
    # Handle preview mode
    if mode == "preview":
        # Check file size
        file_size = full_path.stat().st_size
        if file_size > MAX_PREVIEW_SIZE:
            return JsonResponse({
                "error": f"File too large for preview (max {MAX_PREVIEW_SIZE / 1024 / 1024:.1f}MB)",
                "size": file_size,
            }, status=413)
        
        # Determine file type and read accordingly
        suffix = full_path.suffix.lower()
        if suffix == ".txt":
            result = _read_text_file_preview(full_path)
        elif suffix == ".pdf":
            result = _read_pdf_preview(full_path)
        else:
            return JsonResponse({"error": f"Unsupported file type: {suffix}"}, status=400)
        
        if "error" in result:
            return JsonResponse(result, status=500)
        
        result["path"] = file_path
        result["name"] = full_path.name
        return JsonResponse(result)
    
    # Handle open_os mode
    elif mode == "open_os":
        try:
            # Cross-platform file opening
            if sys.platform == "win32":
                # Windows
                os.startfile(str(full_path))
            elif sys.platform == "darwin":
                # macOS
                subprocess.run(["open", str(full_path)], check=True)
            else:
                # Linux and other Unix-like systems
                subprocess.run(["xdg-open", str(full_path)], check=True)
            
            return JsonResponse({
                "success": True,
                "message": "File opened successfully",
                "path": file_path,
            })
        except subprocess.CalledProcessError as e:
            return JsonResponse({
                "error": f"Failed to open file: {str(e)}",
                "path": file_path,
            }, status=500)
        except Exception as e:
            return JsonResponse({
                "error": f"Unexpected error: {str(e)}",
                "path": file_path,
            }, status=500)
    
    else:
        return JsonResponse({"error": f"Invalid mode: {mode}. Use 'preview' or 'open_os'"}, status=400)

