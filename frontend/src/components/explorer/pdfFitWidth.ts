import type { PDFPageProxy } from 'pdfjs-dist';
import { PDF_ZOOM_MAX, PDF_ZOOM_MIN } from './zoomInput';

/**
 * Zoom percent so the page width matches the scroll area's content width
 * (viewport clientWidth minus horizontal padding).
 */
export function computePdfFitWidthZoomPercent(page: PDFPageProxy, scrollRoot: HTMLElement): number {
  const cs = getComputedStyle(scrollRoot);
  const padL = Number.parseFloat(cs.paddingLeft) || 0;
  const padR = Number.parseFloat(cs.paddingRight) || 0;
  const available = Math.max(1, scrollRoot.clientWidth - padL - padR);
  const base = page.getViewport({ scale: 1 });
  const raw = (available / base.width) * 100;
  return Math.round(Math.max(PDF_ZOOM_MIN, Math.min(PDF_ZOOM_MAX, raw)));
}
