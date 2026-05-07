import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePdfPreviewScale } from './usePdfPreviewScale';

describe('usePdfPreviewScale', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns zoom percent immediately on mount', () => {
    const { result } = renderHook(() => usePdfPreviewScale(80, 'docs/a.pdf'));
    expect(result.current).toBe(80);
  });

  it('debounces zoom changes', () => {
    const { result, rerender } = renderHook(
      ({ zoom, path }) => usePdfPreviewScale(zoom, path),
      { initialProps: { zoom: 80, path: 'docs/a.pdf' } }
    );
    expect(result.current).toBe(80);

    rerender({ zoom: 90, path: 'docs/a.pdf' });
    expect(result.current).toBe(80);

    act(() => {
      vi.advanceTimersByTime(120);
    });
    expect(result.current).toBe(90);
  });

  it('resets debounce and updates immediately when path changes', () => {
    const { result, rerender } = renderHook(
      ({ zoom, path }) => usePdfPreviewScale(zoom, path),
      { initialProps: { zoom: 80, path: 'docs/a.pdf' } }
    );

    rerender({ zoom: 100, path: 'docs/a.pdf' });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toBe(80);

    rerender({ zoom: 100, path: 'docs/b.pdf' });
    expect(result.current).toBe(100);
  });
});
