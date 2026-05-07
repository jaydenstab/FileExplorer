# Security notes

## Threat model

This project is intended primarily as a **local or trusted-network developer tool**: Django serves a filesystem-backed explorer with semantic search, PDF preview, and optional library uploads.

If you expose the app to the **public internet** without additional controls, treat that as **out of scope** for the default configuration unless you add authentication, authorization, rate limiting, and hardened transport.

## CSRF-exempt API endpoints

Several endpoints use `@csrf_exempt` (for example library upload/import and reindex start in `explorer/views_library.py` and `explorer/views_reindex.py`). That is appropriate for **cookie-free, same-origin tooling** or when the app sits behind **network isolation** (VPN, localhost-only, reverse proxy with mutual TLS).

**Hardening options for production or multi-tenant use:**

- Prefer **token-based API authentication** (e.g. `Authorization: Bearer …`) and avoid session cookies for mutating calls.
- If you use **session cookies**, remove `csrf_exempt` and send a CSRF token from the SPA (Django’s `EnsureCsrfCookie` + `X-CSRFToken` header pattern).
- Restrict mutating routes by **network policy** (bind to `127.0.0.1`, firewall, or authenticated reverse proxy).

## Path and file access

File open, preview, and embed routes validate paths against allowed document roots (`explorer/path_policy.py`). Keep `ALLOWED_DOCUMENT_DIRECTORIES` and library root configuration aligned with what you index and serve.

## Dependency and secret hygiene

- Do not commit API keys, tokens, or production database URLs.
- Regenerate credentials if they were ever committed to git history.
