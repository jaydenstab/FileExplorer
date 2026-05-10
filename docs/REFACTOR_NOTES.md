# Explorer frontend: refactor guidelines

This note captures conventions agreed for incremental refactors (no big-bang rewrite).

## Server state: React Query first

Use `useQuery` / `useMutation` for anything that talks to the API (search, recent files, preview content, rename, reindex). Prefer query keys that include every input that affects the response (see `buildSearchDescriptor` for search).

Avoid `useEffect` that only exists to “fetch when X changes”; that is what `enabled` and `queryKey` are for.

## Local UI state: `useState` in feature hooks

Pagination, sidebar toggles, debounced search input, results view mode (list vs details), and selected row index stay in `useExplorerState` (or small dedicated hooks such as `useRecentFiles`) rather than in effects.

## Composition: “controller” as wiring only

`useExplorerController` composes state, search, reindex, preview, feedback, shell, recent, and rename. It should stay mostly `useMemo` bundles and stable callbacks; heavy logic belongs in the child hooks or in pure helpers (`types.ts`). Rename-specific mutation and query invalidation live in `useExplorerRename.ts`.

## When `useEffect` is appropriate

Use effects for: subscribing to window events, synchronizing with non-React stores, animation timers, and clearing intervals on unmount. Preview panel still uses a short effect for loading timeout and status bar text; that is intentional.

## E2E guard

Changes that touch search, preview, or layout should keep `frontend/e2e/explorer-smoke.spec.ts` passing under `CI_E2E=1`.
