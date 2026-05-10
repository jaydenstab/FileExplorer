import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface SearchResultContextMenuProps {
  x: number;
  y: number;
  kind: 'file' | 'folder';
  onRename: () => void;
  onClose: () => void;
}

/**
 * Small anchored menu for search result rows (right-click or overflow button).
 * Portals to document.body to avoid overflow clipping; clamps to viewport.
 */
export function SearchResultContextMenu({ x, y, kind, onRename, onClose }: SearchResultContextMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let left = x;
    let top = y;
    const pad = 8;
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - rect.width - pad);
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - rect.height - pad);
    }
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [x, y]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onPointerDown = (e: MouseEvent | PointerEvent) => {
      const t = e.target as Node | null;
      if (t && panelRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [onClose]);

  const label = kind === 'folder' ? 'Rename folder…' : 'Rename file…';

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      aria-label="Result actions"
      className="fixed z-[100] min-w-[11rem] rounded-md border border-[var(--color-border)] bg-[var(--color-card)] py-1 shadow-lg"
      style={{ left: x, top: y }}
    >
      <button
        type="button"
        role="menuitem"
        className="w-full px-3 py-2 text-left text-sm text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
        onClick={() => {
          onRename();
          onClose();
        }}
      >
        {label}
      </button>
    </div>,
    document.body
  );
}
