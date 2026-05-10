import { useEffect, useRef, useCallback } from 'react';
import { ExternalLink, AlertCircle, Loader2 } from 'lucide-react';
import type { PreviewData } from '../../lib/api';
import { PdfPreviewViewport } from './PdfPreviewViewport';
import { PreviewHeader } from './PreviewHeader';
import { usePreviewZoomControls } from './usePreviewZoomControls';

interface PreviewPanelProps {
  previewData: PreviewData | null;
  previewError: string | null;
  previewErrorPath: string | null;
  isPreviewLoading?: boolean;
  onClose: () => void;
  /** Open file with system app by path (API path, no leading slash). */
  onOpenPath: (path: string) => void;
}

export function PreviewPanel({
  previewData,
  previewError,
  previewErrorPath,
  isPreviewLoading = false,
  onClose,
  onOpenPath,
}: PreviewPanelProps) {
  const advancedPdfPreviewEnabled = import.meta.env.VITE_PDF_ADVANCED_PREVIEW !== 'false';
  const isTextPreview = previewData?.type === 'text';
  const isPdfPreview = previewData?.type === 'pdf';
  const currentContentPath =
    isTextPreview || isPdfPreview ? previewData!.path : null;
  const hasZoomControls = isTextPreview || isPdfPreview;

  const zoomControls = usePreviewZoomControls({
    isPdfPreview,
    hasZoomControls,
    currentContentPath,
  });

  const {
    zoomPercent,
    wrapLines,
    setWrapLines,
    sensitivity,
    setSensitivity,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    pdfFitWidthActive,
    pdfFitWidthNonce,
    applyPdfFitWidthZoom,
    panelRef,
    wheelTicksRef,
  } = zoomControls;

  const textViewportRef = useRef<HTMLDivElement>(null);
  const hasCenteredForPathRef = useRef<string | null>(null);
  const prevContentPathRef = useRef<string | null>(null);
  const currentContentPathRef = useRef(currentContentPath);
  currentContentPathRef.current = currentContentPath;

  useEffect(() => {
    if (currentContentPath !== prevContentPathRef.current) {
      prevContentPathRef.current = currentContentPath;
      hasCenteredForPathRef.current = null;
      if (currentContentPath) {
        const el = textViewportRef.current;
        if (el) {
          el.scrollTop = 0;
          el.scrollLeft = 0;
        }
      }
    }
  }, [currentContentPath]);

  const centerPdfInitialScroll = useCallback((path: string) => {
    if (currentContentPathRef.current !== path) return;
    const el = textViewportRef.current;
    if (!el) return;
    if (hasCenteredForPathRef.current === path) return;
    hasCenteredForPathRef.current = path;
    requestAnimationFrame(() => {
      if (currentContentPathRef.current !== path) return;
      const scrollEl = textViewportRef.current;
      if (!scrollEl) return;
      const { scrollHeight, clientHeight } = scrollEl;
      // LTR: start at the left edge. Horizontally centering wide pages showed only the
      // middle vertical band on narrow viewports (every line looked cut off on both sides).
      const scrollLeft = 0;
      const scrollTop =
        scrollHeight <= clientHeight
          ? Math.max(0, (scrollHeight - clientHeight) / 2)
          : 0;
      scrollEl.scrollLeft = scrollLeft;
      scrollEl.scrollTop = scrollTop;
    });
  }, []);

  if (!previewData && !previewError && !isPreviewLoading) return null;

  return (
    <aside
      ref={panelRef}
      className="w-full h-full flex flex-col overflow-hidden border-l-2 border-[var(--color-border)] bg-[var(--color-muted)]/40"
      role="complementary"
      aria-label="File preview"
      {...(import.meta.env.DEV && { 'data-debug-wheel-ticks': String(wheelTicksRef.current) })}
    >
      {isPreviewLoading && !previewData && !previewError ? (
        <>
          <PreviewHeader variant="loading" onClose={onClose} />
          <div className="flex-1 flex items-center justify-center min-h-0">
            <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
          </div>
        </>
      ) : previewError ? (
        <>
          <PreviewHeader
            variant="error"
            previewErrorPath={previewErrorPath}
            onClose={onClose}
          />
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center min-h-0 overscroll-contain">
            <div className="text-center max-w-md">
              <AlertCircle className="w-12 h-12 text-[var(--color-error)] mx-auto mb-4" />
              <p className="text-[var(--color-error)] mb-6 text-base">
                {previewError}
              </p>
              {previewErrorPath && previewError.toLowerCase().includes('too large') && (
                <button
                  onClick={() => {
                    if (previewErrorPath) {
                      onOpenPath(previewErrorPath);
                      onClose();
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/80 text-white rounded-lg transition-colors mx-auto"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open with System Application
                </button>
              )}
            </div>
          </div>
        </>
      ) : previewData ? (
        <>
          <PreviewHeader
            variant="success"
            name={previewData.name}
            path={previewData.path}
            onClose={onClose}
            onOpenPath={onOpenPath}
            hasZoomControls={hasZoomControls}
            isTextPreview={isTextPreview}
            zoomPercent={zoomPercent}
            wrapLines={wrapLines}
            sensitivity={sensitivity}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomReset={handleZoomReset}
            onSensitivityChange={setSensitivity}
            onWrapToggle={() => setWrapLines((w) => !w)}
          />

          <div
            ref={textViewportRef}
            data-testid="preview-scroll-root"
            className="flex-1 overflow-auto p-4 min-h-0 overscroll-contain"
            tabIndex={0}
            title="Cmd/Ctrl + scroll to zoom. Use - + buttons or Cmd/Ctrl +/- to zoom."
          >
            {previewData.type === 'text' ? (
              <pre
                className={`font-mono bg-[var(--color-background)] rounded p-3 border border-[var(--color-border)]/50 text-[var(--color-foreground)] max-w-full ${wrapLines ? 'break-words' : ''}`}
                style={{
                  fontSize: `${(zoomPercent / 100) * 14}px`,
                  whiteSpace: wrapLines ? 'pre-wrap' : 'pre',
                }}
              >
                {previewData.content}
              </pre>
            ) : (
              <div className="min-h-full flex flex-col items-center justify-center">
                {advancedPdfPreviewEnabled ? (
                  <PdfPreviewViewport
                    path={previewData.path}
                    zoomPercent={zoomPercent}
                    scrollRootRef={textViewportRef}
                    onFirstPageRender={centerPdfInitialScroll}
                    pdfFitWidthActive={pdfFitWidthActive}
                    pdfFitWidthNonce={pdfFitWidthNonce}
                    onPdfFitWidthZoom={applyPdfFitWidthZoom}
                  />
                ) : (
                  <div className="text-center max-w-sm p-6">
                    <p className="text-[var(--color-foreground)]/70 mb-3">
                      Advanced PDF preview is disabled. Open with your system viewer.
                    </p>
                    <button
                      onClick={() => onOpenPath(previewData.path)}
                      className="px-3 py-2 rounded bg-[var(--color-primary)] text-white hover:opacity-90"
                    >
                      Open PDF
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : null}
    </aside>
  );
}
