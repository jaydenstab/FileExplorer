import { useState, useEffect, useRef } from 'react';

const DEBOUNCE_MS = 120;

/**
 * Returns a debounced zoom percent for PDF rendering.
 * Debouncing avoids re-creating placeholders and re-rendering pages on every
 * zoom wheel tick. Resets immediately when path changes so a new document
 * shows at the correct zoom without delay.
 */
export function usePdfPreviewScale(zoomPercent: number, path: string): number {
  const [debouncedZoomPercent, setDebouncedZoomPercent] = useState(zoomPercent);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      setDebouncedZoomPercent(zoomPercent);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [zoomPercent]);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setDebouncedZoomPercent(zoomPercent);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run on path change to reset debounce
  }, [path]);

  return debouncedZoomPercent;
}
