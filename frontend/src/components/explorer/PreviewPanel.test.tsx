import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreviewPanel } from './PreviewPanel';

vi.mock('./PdfPreviewViewport', () => ({
  PdfPreviewViewport: ({ path, onFirstPageRender }: { path: string; onFirstPageRender?: (p: string) => void }) => {
    const { useEffect } = require('react');
    useEffect(() => {
      onFirstPageRender?.(path);
    }, [path, onFirstPageRender]);
    return <div data-testid="pdf-viewport" style={{ width: 800, height: 600 }} />;
  },
}));

describe('PreviewPanel zoom controls', () => {
  const defaultProps = {
    previewData: {
      type: 'text' as const,
      content: 'Hello world',
      name: 'test.txt',
      path: 'docs/test.txt',
    },
    previewError: null,
    previewErrorPath: null,
    isPreviewLoading: false,
    onClose: vi.fn(),
    onOpenPath: vi.fn(),
  };

  it('renders zoom controls for text preview', () => {
    render(<PreviewPanel {...defaultProps} />);
    expect(screen.getByLabelText('Zoom out')).toBeInTheDocument();
    expect(screen.getByLabelText('Zoom in')).toBeInTheDocument();
    expect(screen.getByLabelText('Reset zoom')).toBeInTheDocument();
    expect(screen.getByText(/80%/)).toBeInTheDocument();
  });

  it('zoom in button increases zoom', async () => {
    const user = userEvent.setup();
    render(<PreviewPanel {...defaultProps} />);
    const zoomIn = screen.getByLabelText('Zoom in');
    await user.click(zoomIn);
    await user.click(zoomIn);
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });

  it('zoom out button decreases zoom', async () => {
    const user = userEvent.setup();
    render(<PreviewPanel {...defaultProps} />);
    const zoomOut = screen.getByLabelText('Zoom out');
    await user.click(zoomOut);
    await user.click(zoomOut);
    expect(screen.getByText(/60%/)).toBeInTheDocument();
  });

  it('reset zoom button restores to default (80%)', async () => {
    const user = userEvent.setup();
    render(<PreviewPanel {...defaultProps} />);
    await user.click(screen.getByLabelText('Zoom in'));
    await user.click(screen.getByLabelText('Zoom in'));
    expect(screen.getByText(/100%/)).toBeInTheDocument();
    await user.click(screen.getByLabelText('Reset zoom'));
    expect(screen.getByText(/80%/)).toBeInTheDocument();
  });

  it('renders wrap toggle for text preview', () => {
    render(<PreviewPanel {...defaultProps} />);
    expect(screen.getByLabelText('Wrap lines')).toBeInTheDocument();
  });

  it('has accessible labels on Open and Close', () => {
    render(<PreviewPanel {...defaultProps} />);
    expect(screen.getByLabelText('Open with system application')).toBeInTheDocument();
    expect(screen.getByLabelText('Close preview')).toBeInTheDocument();
  });

  it('plain wheel without modifier does not zoom', () => {
    const { container } = render(<PreviewPanel {...defaultProps} />);
    const viewport = container.querySelector('[tabindex="0"]');
    expect(viewport).toBeInTheDocument();
    const wheelEvent = new WheelEvent('wheel', {
      deltaY: -100,
      deltaMode: 0,
      ctrlKey: false,
      metaKey: false,
      bubbles: true,
    });
    viewport!.dispatchEvent(wheelEvent);
    viewport!.dispatchEvent(wheelEvent);
    expect(screen.getByText(/80%/)).toBeInTheDocument();
  });

  it('renders PDF preview with onFirstPageRender for initial centering', async () => {
    const pdfProps = {
      ...defaultProps,
      previewData: {
        type: 'pdf' as const,
        name: 'doc.pdf',
        path: 'docs/doc.pdf',
      },
    };
    const { container } = render(<PreviewPanel {...pdfProps} />);
    expect(screen.getByTestId('pdf-viewport')).toBeInTheDocument();
    await waitFor(() => {
      const viewport = container.querySelector('[tabindex="0"]');
      expect(viewport).toBeInTheDocument();
    });
  });

  it('wheel with Cmd/Ctrl modifier zooms (touchpad-style)', async () => {
    const { container } = render(<PreviewPanel {...defaultProps} />);
    const viewport = container.querySelector('[tabindex="0"]');
    expect(viewport).toBeInTheDocument();
    const wheelEvent = new WheelEvent('wheel', {
      deltaY: -100,
      deltaMode: 0,
      ctrlKey: true,
      bubbles: true,
    });
    viewport!.dispatchEvent(wheelEvent);
    viewport!.dispatchEvent(wheelEvent);
    viewport!.dispatchEvent(wheelEvent);
    await waitFor(() => {
      expect(screen.getByText(/1[01]0%/)).toBeInTheDocument();
    });
  });

  it('Cmd/Ctrl + = zooms in when focus is inside panel', async () => {
    const { container } = render(<PreviewPanel {...defaultProps} />);
    const viewport = container.querySelector('[tabindex="0"]') as HTMLElement;
    viewport.focus();
    expect(document.activeElement).toBe(viewport);

    await act(async () => {
      const keyEvent = new KeyboardEvent('keydown', {
        key: '=',
        metaKey: true,
        bubbles: true,
      });
      window.dispatchEvent(keyEvent);
    });
    await waitFor(() => {
      expect(screen.getByText(/90%/)).toBeInTheDocument();
    });
  });

  it('Cmd/Ctrl + 0 resets zoom when focus is inside panel', async () => {
    const user = userEvent.setup();
    const { container } = render(<PreviewPanel {...defaultProps} />);
    await user.click(screen.getByLabelText('Zoom in'));
    await user.click(screen.getByLabelText('Zoom in'));
    expect(screen.getByText(/100%/)).toBeInTheDocument();

    const viewport = container.querySelector('[tabindex="0"]') as HTMLElement;
    viewport.focus();
    await act(async () => {
      const keyEvent = new KeyboardEvent('keydown', {
        key: '0',
        metaKey: true,
        bubbles: true,
      });
      window.dispatchEvent(keyEvent);
    });
    await waitFor(() => {
      expect(screen.getByText(/80%/)).toBeInTheDocument();
    });
  });

  it('keyboard zoom does not fire when focus is outside panel', async () => {
    render(
      <>
        <button data-testid="outside">Outside</button>
        <PreviewPanel {...defaultProps} />
      </>
    );
    const outside = screen.getByTestId('outside');
    outside.focus();
    expect(document.activeElement).toBe(outside);

    const keyEvent = new KeyboardEvent('keydown', {
      key: '=',
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(keyEvent);
    expect(screen.getByText(/80%/)).toBeInTheDocument();
  });

  it('zoom resets when switching to a different file', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<PreviewPanel {...defaultProps} />);
    await user.click(screen.getByLabelText('Zoom in'));
    await user.click(screen.getByLabelText('Zoom in'));
    expect(screen.getByText(/100%/)).toBeInTheDocument();

    rerender(
      <PreviewPanel
        {...defaultProps}
        previewData={{
          type: 'text' as const,
          content: 'Different file',
          name: 'other.txt',
          path: 'docs/other.txt',
        }}
      />
    );
    await waitFor(() => {
      expect(screen.getByText(/80%/)).toBeInTheDocument();
    });
  });

  it('sensitivity buttons can be toggled', async () => {
    const user = userEvent.setup();
    render(<PreviewPanel {...defaultProps} />);
    const slowBtn = screen.getByLabelText('Sensitivity slow');
    const normalBtn = screen.getByLabelText('Sensitivity normal');
    expect(normalBtn).toHaveAttribute('aria-pressed', 'true');

    await user.click(slowBtn);
    expect(slowBtn).toHaveAttribute('aria-pressed', 'true');
    expect(normalBtn).toHaveAttribute('aria-pressed', 'false');
  });
});
