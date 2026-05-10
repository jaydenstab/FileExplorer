import { describe, it, expect } from 'vitest';
import { computePdfFitWidthZoomPercent } from './pdfFitWidth';

describe('computePdfFitWidthZoomPercent', () => {
  it('maps page width to scroll content width as zoom percent', () => {
    const root = document.createElement('div');
    root.style.width = '400px';
    root.style.padding = '0';
    root.style.boxSizing = 'border-box';
    document.body.appendChild(root);
    Object.defineProperty(root, 'clientWidth', { value: 400, configurable: true });

    const page = {
      getViewport: ({ scale }: { scale: number }) => ({
        width: 800 * scale,
        height: 600 * scale,
      }),
    };

    expect(computePdfFitWidthZoomPercent(page as never, root)).toBe(50);
    document.body.removeChild(root);
  });

  it('subtracts horizontal padding from available width', () => {
    const root = document.createElement('div');
    root.style.width = '500px';
    root.style.paddingLeft = '50px';
    root.style.paddingRight = '50px';
    document.body.appendChild(root);
    Object.defineProperty(root, 'clientWidth', { value: 500, configurable: true });

    const page = {
      getViewport: ({ scale }: { scale: number }) => ({
        width: 400 * scale,
        height: 300 * scale,
      }),
    };

    expect(computePdfFitWidthZoomPercent(page as never, root)).toBe(100);
    document.body.removeChild(root);
  });
});
