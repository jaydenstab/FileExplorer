import { useLayoutEffect } from 'react';

const DEFAULT_PAGE_HEIGHT = 1100;

interface UsePdfPlaceholderLayoutParams {
  containerRef: React.RefObject<HTMLDivElement | null>;
  path: string;
  numPages: number;
  scale: number;
  onBeforeRebuild: () => void;
  onAfterRebuild: () => void;
}

export function usePdfPlaceholderLayout({
  containerRef,
  path,
  numPages,
  scale,
  onBeforeRebuild,
  onAfterRebuild,
}: UsePdfPlaceholderLayoutParams) {
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || numPages === 0) return;

    onBeforeRebuild();
    while (container.firstChild) container.removeChild(container.firstChild);

    const placeholderHeight = DEFAULT_PAGE_HEIGHT * scale;
    for (let i = 1; i <= numPages; i++) {
      const wrapper = document.createElement('div');
      wrapper.dataset.pdfPageIndex = String(i);
      wrapper.style.minHeight = `${placeholderHeight}px`;
      wrapper.style.marginBottom = '0.25rem';
      wrapper.style.position = 'relative';
      wrapper.style.background = 'var(--color-background)';
      container.appendChild(wrapper);
    }
    onAfterRebuild();
  }, [containerRef, path, numPages, scale, onBeforeRebuild, onAfterRebuild]);
}
