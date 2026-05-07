import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { pdfjsLib } from '../../lib/pdfWorker';
import { getPdfEmbedUrl } from '../../lib/api';

export interface UsePdfDocumentResult {
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

  useEffect(() => {
    if (currentPathRef.current === path && pdfDocRef.current) return;
    currentPathRef.current = path;
    pdfDocRef.current = null;
    setLoading(true);
    setError(null);
    setNumPages(0);
    onReset();

    const loadingTask = pdfjsLib.getDocument({ url: getPdfEmbedUrl(path) });
    loadingTask.promise
      .then((pdfDoc) => {
        if (currentPathRef.current !== path) return;
        pdfDocRef.current = pdfDoc;
        setNumPages(pdfDoc.numPages);
        setLoading(false);
      })
      .catch((err) => {
        if (currentPathRef.current !== path) return;
        const msg = err instanceof Error ? err.message : 'Failed to load PDF';
        const fallback = /worker|loading/i.test(msg)
          ? 'PDF worker failed to load. Try refreshing the page.'
          : msg;
        setError(fallback);
        setLoading(false);
      });

    return () => {
      loadingTask.destroy?.();
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
