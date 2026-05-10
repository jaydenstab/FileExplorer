# File Explorer frontend

Vite + React + TypeScript SPA for the AI File Explorer (search, preview, library, reindex UI).

Full-stack setup, API reference, and CI notes: **[repository README](../README.md)**.

## Prerequisites

- Node.js (current LTS recommended)
- Backend running (see root README) so API calls from `npm run dev` succeed

## Commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Vite dev server (default [http://localhost:5173/](http://localhost:5173/)) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve production build locally |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests |
| `npm run test:e2e` | Playwright only (needs Django on :8000 and preview on `E2E_BASE_URL`; or run `bash scripts/run-e2e.sh` from repo root — root README) |
| `npm run verify:repo` | Lint + tests + repo hygiene (used in CI) |

## Configuration

- API base: `VITE_API_BASE_URL` (defaults to `/api` relative to the dev origin). See root README for Django port (`8000`).

## Code layout

Explorer UI and hooks live under `src/components/explorer/`. Conventions: [docs/REFACTOR_NOTES.md](../docs/REFACTOR_NOTES.md).

## Dead code and exports

From `frontend/`, run `npx knip@5` (no local install required) to find unused dependencies, exports, and files. Fix or suppress findings before large refactors.
