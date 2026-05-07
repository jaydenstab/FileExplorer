"""Shared JSON API response helpers."""
from __future__ import annotations

from typing import Any, Dict

from django.http import JsonResponse


def api_ok(payload: Dict[str, Any], status: int = 200) -> JsonResponse:
    return JsonResponse(payload, status=status)


def api_error(
    code: str,
    message: str,
    status: int,
    *,
    details: Dict[str, Any] | None = None,
) -> JsonResponse:
    body: Dict[str, Any] = {
        "error": {
            "code": code,
            "message": message,
        }
    }
    if details:
        body["error"]["details"] = details
    return JsonResponse(body, status=status)
