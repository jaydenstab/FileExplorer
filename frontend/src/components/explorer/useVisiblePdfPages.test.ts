import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVisiblePdfPages } from './useVisiblePdfPages';

describe('useVisiblePdfPages', () => {
  const originalIntersectionObserver = globalThis.IntersectionObserver;
  let callback: IntersectionObserverCallback | null = null;

  beforeEach(() => {
    callback = null;
    class MockIntersectionObserver implements IntersectionObserver {
      readonly root: Element | Document | null = null;
      readonly rootMargin = '0px';
      readonly thresholds: ReadonlyArray<number> = [0];
      constructor(cb: IntersectionObserverCallback) {
        callback = cb;
      }
      disconnect = vi.fn();
      observe = vi.fn();
      takeRecords = vi.fn(() => []);
      unobserve = vi.fn();
    }
    globalThis.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    if (originalIntersectionObserver) {
      globalThis.IntersectionObserver = originalIntersectionObserver;
    } else {
      delete (globalThis as Partial<typeof globalThis>).IntersectionObserver;
    }
  });

  it('avoids no-op state updates when visibility membership is unchanged', () => {
    const container = document.createElement('div');
    const scrollRoot = document.createElement('div');
    const p1 = document.createElement('div');
    p1.dataset.pdfPageIndex = '1';
    const p2 = document.createElement('div');
    p2.dataset.pdfPageIndex = '2';
    container.appendChild(p1);
    container.appendChild(p2);

    const containerRef = { current: container };
    const scrollRootRef = { current: scrollRoot };

    const { result } = renderHook(() =>
      useVisiblePdfPages(containerRef, scrollRootRef, 2, 'k1')
    );

    expect(result.current.has(1)).toBe(true);
    expect(result.current.has(2)).toBe(false);
    expect(callback).not.toBeNull();
    const beforeNoop = result.current;

    act(() => {
      callback?.(
        [{ target: p1, isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });
    expect(result.current).toBe(beforeNoop);

    act(() => {
      callback?.(
        [{ target: p2, isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });
    expect(result.current).not.toBe(beforeNoop);
    expect(result.current.has(2)).toBe(true);
  });
});
