/**
 * PDF page render scheduler.
 *
 * Schedules work in batches using requestIdleCallback (or setTimeout fallback)
 * to avoid blocking the main thread. Used for rendering PDF pages 2..N after
 * page 1 is rendered immediately.
 */

const IDLE_TIMEOUT_MS = 200;

/**
 * Schedules processing of items in batches of `batchSize`, yielding to the
 * main thread between batches via requestIdleCallback.
 * Returns a no-op cancel function (the actual cancellation of async work
 * must be handled by the caller via their own task cancellation).
 */
export function scheduleBatchedIdleWork<T>(
  items: T[],
  batchSize: number,
  process: (item: T) => void
): () => void {
  if (items.length === 0) return () => {};

  const hasIdleCallback = typeof requestIdleCallback !== 'undefined';
  let queuedHandle: number | null = null;

  const schedule = (fn: () => void) => {
    if (hasIdleCallback) {
      queuedHandle = requestIdleCallback(fn, { timeout: IDLE_TIMEOUT_MS });
      return;
    }
    queuedHandle = window.setTimeout(fn, 0);
  };

  const cancelQueued = () => {
    if (queuedHandle === null) return;
    if (hasIdleCallback && typeof cancelIdleCallback !== 'undefined') {
      cancelIdleCallback(queuedHandle);
    } else {
      window.clearTimeout(queuedHandle);
    }
    queuedHandle = null;
  };

  let cancelled = false;
  let idx = 0;

  const runNext = () => {
    queuedHandle = null;
    if (cancelled || idx >= items.length) return;
    const batch = items.slice(idx, idx + batchSize);
    idx += batch.length;
    batch.forEach(process);
    if (idx < items.length) schedule(runNext);
  };

  schedule(runNext);

  return () => {
    cancelled = true;
    cancelQueued();
  };
}
