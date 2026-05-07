import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scheduleBatchedIdleWork } from './pdfRenderScheduler';

describe('scheduleBatchedIdleWork', () => {
  const originalRequestIdleCallback = globalThis.requestIdleCallback;
  const originalCancelIdleCallback = globalThis.cancelIdleCallback;

  beforeEach(() => {
    vi.useFakeTimers();
    delete (globalThis as Partial<typeof globalThis>).requestIdleCallback;
    delete (globalThis as Partial<typeof globalThis>).cancelIdleCallback;
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalRequestIdleCallback) {
      globalThis.requestIdleCallback = originalRequestIdleCallback;
    } else {
      delete (globalThis as Partial<typeof globalThis>).requestIdleCallback;
    }
    if (originalCancelIdleCallback) {
      globalThis.cancelIdleCallback = originalCancelIdleCallback;
    } else {
      delete (globalThis as Partial<typeof globalThis>).cancelIdleCallback;
    }
  });

  it('processes items in batches', () => {
    const processed: number[] = [];
    const cancel = scheduleBatchedIdleWork(
      [1, 2, 3, 4, 5],
      2,
      (n) => processed.push(n)
    );

    vi.runAllTimers();

    expect(processed).toEqual([1, 2, 3, 4, 5]);
    cancel();
  });

  it('returns no-op cancel for empty items', () => {
    const processed: number[] = [];
    const cancel = scheduleBatchedIdleWork([], 2, (n) => processed.push(n));

    vi.runAllTimers();

    expect(processed).toEqual([]);
    expect(() => cancel()).not.toThrow();
  });

  it('cancel stops further processing', () => {
    const processed: number[] = [];
    const cancel = scheduleBatchedIdleWork(
      [1, 2, 3, 4, 5],
      2,
      (n) => processed.push(n)
    );

    vi.advanceTimersByTime(0);
    cancel();
    vi.runAllTimers();

    expect(processed.length).toBeLessThanOrEqual(2);
  });

  it('cancel before first run prevents processing (timeout fallback)', () => {
    const processed: number[] = [];
    const cancel = scheduleBatchedIdleWork([1, 2, 3], 1, (n) => processed.push(n));

    cancel();
    vi.runAllTimers();

    expect(processed).toEqual([]);
  });

  it('uses idle callback branch and cancels queued idle work', () => {
    const idleQueue = new Map<number, () => void>();
    let nextId = 1;
    const cancelSpy = vi.fn((id: number) => idleQueue.delete(id));
    globalThis.requestIdleCallback = vi.fn((cb: IdleRequestCallback) => {
      const id = nextId++;
      idleQueue.set(id, () => cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline));
      return id;
    });
    globalThis.cancelIdleCallback = cancelSpy;

    const processed: number[] = [];
    const cancel = scheduleBatchedIdleWork([1, 2, 3, 4], 1, (n) => processed.push(n));

    // Run first queued idle callback manually, then cancel before next one executes.
    idleQueue.get(1)?.();
    cancel();
    idleQueue.get(2)?.();

    expect(processed).toEqual([1]);
    expect(cancelSpy).toHaveBeenCalledWith(2);
  });
});
