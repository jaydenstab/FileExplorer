import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { getPdfJsLib } from '../../lib/pdfWorker';
import { getPdfEmbedUrl } from '../../lib/api';

interface UsePdfDocumentResult {
  pdfDocRef: React.MutableRefObject<PDFDocumentProxy | null>;
  currentPathRef: React.MutableRefObject<string | null>;
  numPages: number;
  loading: boolean;
  error: string | null;
  setNumPages: React.Dispatch<React.SetStateAction<number>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

export function usePdfDocument(path: string, onReset: () => void): UsePdfDocumentResult {
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const currentPathRef = useRef<string | null>(null);
  const loadingTaskRef = useRef<{ destroy?: () => void } | null>(null);

  useEffect(() => {
    if (currentPathRef.current === path && pdfDocRef.current) return;
    currentPathRef.current = path;
    pdfDocRef.current = null;
    loadingTaskRef.current = null;
    setLoading(true);
    setError(null);
    setNumPages(0);
    onReset();

    let cancelled = false;

    void (async () => {
      try {
        const pdfjsLib = await getPdfJsLib();
        if (cancelled || currentPathRef.current !== path) return;
        const lt = pdfjsLib.getDocument({ url: getPdfEmbedUrl(path) });
        loadingTaskRef.current = lt;
        const pdfDoc = await lt.promise;
        if (cancelled || currentPathRef.current !== path) return;
        pdfDocRef.current = pdfDoc;
        setNumPages(pdfDoc.numPages);
        setLoading(false);
      } catch (err) {
        if (cancelled || currentPathRef.current !== path) return;
        const msg = err instanceof Error ? err.message : 'Failed to load PDF';
        const fallback = /worker|loading/i.test(msg)
          ? 'PDF worker failed to load. Try refreshing the page.'
          : msg;
        setError(fallback);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      loadingTaskRef.current?.destroy?.();
      loadingTaskRef.current = null;
      currentPathRef.current = null;
      pdfDocRef.current = null;
    };
  }, [path, onReset]);

  return {
    pdfDocRef,
    currentPathRef,
    numPages,
    loading,
    error,
    setNumPages,
    setError,
    setLoading,
  };
}
