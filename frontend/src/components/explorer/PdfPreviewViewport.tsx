import { useState, useEffect, useRef, useCallback } from 'react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { useVisiblePdfPages } from './useVisiblePdfPages';
import { usePdfPreviewScale } from './usePdfPreviewScale';
import { scheduleBatchedIdleWork } from './pdfRenderScheduler';
import { usePdfDocument } from './usePdfDocument';
import { usePdfPlaceholderLayout } from './usePdfPlaceholderLayout';

const MAX_CANVAS_DEVICE_PIXEL_RATIO = 2;

function getOrLoadPage(
  doc: PDFDocumentProxy,
  cache: Map<number, PDFPageProxy>,
  pageNum: number
): Promise<PDFPageProxy> {
  const hit = cache.get(pageNum);
  if (hit) return Promise.resolve(hit);
  return doc.getPage(pageNum).then((p) => {
    cache.set(pageNum, p);
    return p;
  });
}

interface PdfPreviewViewportProps {
  path: string;
  zoomPercent: number;
  scrollRootRef: React.RefObject<HTMLElement | null>;
  /** Called once when the first page has finished rendering. Receives the path for staleness checks. */
  onFirstPageRender?: (path: string) => void;
}

const MAX_CONCURRENT_RENDERS = 3;
const MAX_PAGE_RENDER_RETRIES = 1;
const MAX_PREMEASURE_BATCH = 8;
type RenderTaskLike = { cancel: () => void; promise: Promise<unknown> };

export function PdfPreviewViewport({
  path,
  zoomPercent,
  scrollRootRef,
  onFirstPageRender,
}: PdfPreviewViewportProps) {
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [pageWarning, setPageWarning] = useState<string | null>(null);
  const debouncedZoomPercent = usePdfPreviewScale(zoomPercent, path);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTasksRef = useRef<Map<number, RenderTaskLike>>(new Map());
  const renderCountRef = useRef(0);
  const failedPageCountRef = useRef(0);
  const retryCountRef = useRef<Map<number, number>>(new Map());
  const premeasureCancelRef = useRef<(() => void) | null>(null);
  const pageCacheRef = useRef<Map<number, PDFPageProxy>>(new Map());
  const hasFiredFirstPageRef = useRef(false);
  const onFirstPageRenderRef = useRef(onFirstPageRender);
  const renderedPagesRef = useRef<Set<number>>(new Set());
  onFirstPageRenderRef.current = onFirstPageRender;

  const scale = debouncedZoomPercent / 100;

  const cancelAllRenderTasks = () => {
    renderTasksRef.current.forEach((task) => task.cancel());
    renderTasksRef.current.clear();
  };

  const handleDocReset = useCallback(() => {
    cancelAllRenderTasks();
    premeasureCancelRef.current?.();
    premeasureCancelRef.current = null;
    pageCacheRef.current.clear();
    setPageWarning(null);
    failedPageCountRef.current = 0;
    retryCountRef.current.clear();
  }, []);

  const { pdfDocRef, currentPathRef, numPages, loading, error } = usePdfDocument(
    path,
    handleDocReset
  );

  const visiblePages = useVisiblePdfPages(
    containerRef,
    scrollRootRef,
    numPages,
    `${scale}:${layoutVersion}`
  );

  const handleBeforeLayoutRebuild = useCallback(() => {
    cancelAllRenderTasks();
    premeasureCancelRef.current?.();
    premeasureCancelRef.current = null;
    renderedPagesRef.current = new Set();
    retryCountRef.current.clear();
    if (import.meta.env.DEV) renderCountRef.current = 0;
    hasFiredFirstPageRef.current = false;
  }, []);

  const handleAfterLayoutRebuild = useCallback(() => {
    setLayoutVersion((v) => v + 1);
  }, []);

  usePdfPlaceholderLayout({
    containerRef,
    path,
    numPages,
    scale,
    onBeforeRebuild: handleBeforeLayoutRebuild,
    onAfterRebuild: handleAfterLayoutRebuild,
  });

  useEffect(() => {
    const pdfDoc = pdfDocRef.current;
    if (!pdfDoc || numPages === 0 || !containerRef.current) return;

    const toMeasure = Array.from({ length: numPages }, (_, idx) => idx + 1);
    const cache = pageCacheRef.current;
    const cancel = scheduleBatchedIdleWork(toMeasure, MAX_PREMEASURE_BATCH, (pageNum) => {
      getOrLoadPage(pdfDoc, cache, pageNum)
        .then((page) => {
          if (currentPathRef.current !== path) return;
          const viewport = page.getViewport({ scale });
          const placeholder = containerRef.current?.querySelector(
            `[data-pdf-page-index="${pageNum}"]`
          ) as HTMLElement | null;
          if (placeholder) {
            placeholder.style.minHeight = `${viewport.height}px`;
          }
        })
        .catch(() => {});
    });

    premeasureCancelRef.current = cancel;
    return () => {
      cancel();
      if (premeasureCancelRef.current === cancel) premeasureCancelRef.current = null;
    };
  }, [path, numPages, scale, layoutVersion]);

  /**
   * Render visible pages. Cancellation paths: (1) idle scheduler cancel on visibility update;
   * (2) all render tasks canceled on path/scale rebuild; (3) async guards bail if path changed.
   */
  useEffect(() => {
    const pdfDoc = pdfDocRef.current;
    if (!pdfDoc || numPages === 0 || !containerRef.current) return;

    const container = containerRef.current;
    const placeholders = container.querySelectorAll('[data-pdf-page-index]');
    if (placeholders.length === 0) return;

    const cache = pageCacheRef.current;
    const renderPage = (i: number) => {
      if (renderedPagesRef.current.has(i) || renderTasksRef.current.has(i)) return;
      const placeholder = placeholders[i - 1] as HTMLElement | undefined;
      if (!placeholder) return;

      getOrLoadPage(pdfDoc, cache, i).then((page) => {
        if (currentPathRef.current !== path) return;
        if (renderedPagesRef.current.has(i)) return;

        const displayViewport = page.getViewport({ scale });
        const dprCap = Math.min(
          typeof globalThis !== 'undefined' && 'devicePixelRatio' in globalThis
            ? globalThis.devicePixelRatio
            : 1,
          MAX_CANVAS_DEVICE_PIXEL_RATIO
        );
        const renderViewport = page.getViewport({ scale: scale * dprCap });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Replace coarse placeholder estimate with exact page height once measured.
        // This removes large visual gaps for PDFs with mixed page sizes.
        placeholder.style.minHeight = `${displayViewport.height}px`;

        canvas.width = Math.floor(renderViewport.width);
        canvas.height = Math.floor(renderViewport.height);
        canvas.style.width = `${displayViewport.width}px`;
        canvas.style.height = `${displayViewport.height}px`;
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto';
        canvas.style.border = '1px solid var(--color-border)';
        canvas.style.background = '#fff';

        const renderCtx = {
          canvas,
          canvasContext: ctx,
          viewport: renderViewport,
        };
        const renderTask = page.render(renderCtx);
        renderTasksRef.current.set(i, renderTask);
        renderTask.promise
          .then(() => {
            renderTasksRef.current.delete(i);
            if (currentPathRef.current !== path || renderedPagesRef.current.has(i)) return;
            renderedPagesRef.current.add(i);
            while (placeholder.firstChild) placeholder.removeChild(placeholder.firstChild);
            placeholder.appendChild(canvas);
            if (import.meta.env.DEV) {
              renderCountRef.current = renderedPagesRef.current.size;
              container.setAttribute('data-debug-render-count', String(renderCountRef.current));
            }
            if (i === 1 && !hasFiredFirstPageRef.current && currentPathRef.current === path) {
              hasFiredFirstPageRef.current = true;
              onFirstPageRenderRef.current?.(path);
            }
          })
          .catch(() => {
            renderTasksRef.current.delete(i);
            const retries = retryCountRef.current.get(i) ?? 0;
            if (retries < MAX_PAGE_RENDER_RETRIES && currentPathRef.current === path) {
              retryCountRef.current.set(i, retries + 1);
              renderPage(i);
              return;
            }
            failedPageCountRef.current += 1;
            setPageWarning(
              `Some PDF pages failed to render (${failedPageCountRef.current}). Try zoom reset or reopen file.`
            );
          });
      });
    };

    // Phase A: page 1 immediately
    renderPage(1);

    // Phase B: visible pages 2..N, bounded queue via scheduleBatchedIdleWork
    const toRender = [...visiblePages]
      .filter((p) => p > 1 && !renderedPagesRef.current.has(p))
      .sort((a, b) => a - b);
    const cancelScheduler = scheduleBatchedIdleWork(
      toRender,
      MAX_CONCURRENT_RENDERS,
      (p) => renderPage(p)
    );

    return () => {
      cancelScheduler();
    };
  }, [path, numPages, scale, visiblePages]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-0">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--color-border)] border-t-[var(--color-primary)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-0 p-6">
        <p className="text-[var(--color-error)] text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {pageWarning && (
        <p className="text-xs text-[var(--color-warning,#b45309)] text-center py-1">
          {pageWarning}
        </p>
      )}
      <div className="flex flex-col" ref={containerRef} />
    </div>
  );
}
