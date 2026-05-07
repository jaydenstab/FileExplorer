import { useState, useEffect, useRef, useCallback } from 'react';

const ROOT_MARGIN = '200px';

/**
 * Tracks which page placeholders are visible in the scroll viewport.
 * Returns a Set of 1-based page indices that are visible or near-visible.
 * Uses a single IntersectionObserver for all placeholders (scales better for large PDFs).
 * Uses an explicit scroll root as root (the overflow-auto ancestor).
 * Re-observes when structureKey changes (e.g. scale) since placeholders are recreated.
 */
export function useVisiblePdfPages(
  containerRef: React.RefObject<HTMLDivElement | null>,
  scrollRootRef: React.RefObject<HTMLElement | null>,
  numPages: number,
  structureKey?: number | string
): Set<number> {
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set([1]));
  const observerRef = useRef<IntersectionObserver | null>(null);
  const mountedRef = useRef(true);

  const updateVisibility = useCallback((pageIndex: number, isIntersecting: boolean) => {
    setVisiblePages((prev) => {
      const alreadyVisible = prev.has(pageIndex);
      if ((isIntersecting && alreadyVisible) || (!isIntersecting && !alreadyVisible)) {
        return prev;
      }
      const next = new Set(prev);
      if (isIntersecting) {
        next.add(pageIndex);
      } else {
        next.delete(pageIndex);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, []);

  // Reset to page 1 when structure changes (placeholders recreated)
  useEffect(() => {
    setVisiblePages(new Set([1]));
  }, [structureKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || numPages === 0) return;

    const placeholders = container.querySelectorAll('[data-pdf-page-index]');
    if (placeholders.length === 0) return;

    const scrollRoot = scrollRootRef.current;
    if (!scrollRoot) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!mountedRef.current) return;
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          const pageIndex = parseInt(el.dataset.pdfPageIndex ?? '1', 10);
          if (pageIndex >= 1 && pageIndex <= numPages) {
            updateVisibility(pageIndex, entry.isIntersecting);
          }
        }
      },
      { root: scrollRoot, rootMargin: ROOT_MARGIN, threshold: 0 }
    );

    observerRef.current = observer;
    placeholders.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
      if (observerRef.current === observer) observerRef.current = null;
    };
  }, [containerRef, scrollRootRef, numPages, structureKey, updateVisibility]);

  return visiblePages;
}
