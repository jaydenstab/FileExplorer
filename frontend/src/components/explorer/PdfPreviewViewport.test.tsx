import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PdfPreviewViewport } from './PdfPreviewViewport';

vi.mock('./useVisiblePdfPages', () => ({
  useVisiblePdfPages: () => new Set([1]),
}));

const getDocumentMock = vi.fn();
vi.mock('../../lib/pdfWorker', () => ({
  pdfjsLib: {
    getDocument: (...args: unknown[]) => getDocumentMock(...args),
  },
}));

describe('PdfPreviewViewport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as CanvasRenderingContext2D);
  });

  it('shows warning when page render repeatedly fails', async () => {
    const failingPromise = Promise.reject(new Error('render fail'));
    failingPromise.catch(() => {});
    const renderTask = {
      cancel: vi.fn(),
      promise: failingPromise,
    };
    const page = {
      getViewport: () => ({ width: 400, height: 600 }),
      render: () => renderTask,
    };
    const pdfDoc = {
      numPages: 1,
      getPage: vi.fn().mockResolvedValue(page),
    };
    getDocumentMock.mockReturnValue({
      promise: Promise.resolve(pdfDoc),
      destroy: vi.fn(),
    });

    render(
      <PdfPreviewViewport
        path="documents1/sample.pdf"
        zoomPercent={80}
        scrollRootRef={{ current: document.createElement('div') }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Some PDF pages failed to render/i)).toBeInTheDocument();
    });
  });
});
