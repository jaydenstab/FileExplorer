import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Folder, MoreVertical } from 'lucide-react';
import type { FileItem } from './types';

interface DirectorySidebarProps {
  directories: string[];
  selectedDirectories: string[];
  onToggle: (directory: string) => void;
  recentFiles: FileItem[];
  recentLoading: boolean;
  recentError: Error | null;
  onRecentFileClick: (file: FileItem) => void;
  onRenameDocumentRoot?: (directory: string) => void;
}

/** Small menu for sidebar directory row (portal, closes on outside click). */
function SidebarRootMenu({
  x,
  y,
  onRename,
  onClose,
}: {
  x: number;
  y: number;
  onRename: () => void;
  onClose: () => void;
}) {
  return createPortal(
    <div
      data-sidebar-root-menu
      className="fixed z-[100] min-w-[11rem] rounded-md border border-[var(--color-border)] bg-[var(--color-card)] py-1 shadow-lg"
      style={{ left: x, top: y }}
      role="menu"
      aria-label="Directory actions"
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
        Rename folder…
      </button>
    </div>,
    document.body
  );
}

export function DirectorySidebar({
  directories,
  selectedDirectories,
  onToggle,
  recentFiles,
  recentLoading,
  recentError,
  onRecentFileClick,
  onRenameDocumentRoot,
}: DirectorySidebarProps) {
  const [menu, setMenu] = useState<{ dir: string; x: number; y: number } | null>(null);

  const closeMenu = useCallback(() => setMenu(null), []);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    const onPointerDown = (e: MouseEvent | PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('[data-sidebar-root-menu]')) return;
      closeMenu();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [menu, closeMenu]);

  return (
    <div className="w-64 border-r border-[var(--color-border)] bg-[var(--color-card)] flex flex-col flex-shrink-0 overflow-y-auto">
      <div className="p-4">
        <h2 className="text-xs font-semibold text-[var(--color-foreground)]/60 mb-3 uppercase tracking-wider">
          Places
        </h2>
        <div
          id="recent-files"
          className="mb-6 rounded-lg border border-[var(--color-border)]/80 bg-[var(--color-background)]/40 p-2"
        >
          <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-[var(--color-foreground)]/70">
            <Clock className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
            Recent files
          </div>
          {recentLoading && (
            <p className="px-2 py-2 text-xs text-[var(--color-foreground)]/50">Loading…</p>
          )}
          {recentError && (
            <p className="px-2 py-2 text-xs text-[var(--color-error)]">{recentError.message}</p>
          )}
          {!recentLoading && !recentError && recentFiles.length === 0 && (
            <p className="px-2 py-2 text-xs text-[var(--color-foreground)]/45">No recent files yet.</p>
          )}
          <ul className="mt-1 space-y-0.5 max-h-48 overflow-y-auto">
            {recentFiles.map((file) => (
              <li key={file.id}>
                <button
                  type="button"
                  onClick={() => onRecentFileClick(file)}
                  className="w-full text-left px-2 py-1.5 rounded text-xs text-[var(--color-foreground)]/80 hover:bg-[var(--color-muted)] truncate"
                  title={file.path}
                >
                  {file.name}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <h2 className="text-xs font-semibold text-[var(--color-foreground)]/60 mb-3 uppercase tracking-wider">
          Directories
        </h2>
        <div className="space-y-1">
          {directories.map((directory) => {
            const isSelected = selectedDirectories.includes(directory);
            return (
              <div
                key={directory}
                className="group flex items-center gap-1 rounded-lg border border-transparent hover:border-[var(--color-border)]"
                onContextMenu={(e) => {
                  if (!onRenameDocumentRoot) return;
                  e.preventDefault();
                  setMenu({ dir: directory, x: e.clientX, y: e.clientY });
                }}
              >
                <button
                  type="button"
                  onClick={() => onToggle(directory)}
                  className={`
                    flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left
                    ${
                      isSelected
                        ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/50'
                        : 'text-[var(--color-foreground)]/70 hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]'
                    }
                  `}
                >
                  <div
                    className={`w-4 h-4 border-2 rounded flex items-center justify-center flex-shrink-0 ${
                      isSelected
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]'
                        : 'border-[var(--color-foreground)]/30'
                    }`}
                  >
                    {isSelected && <div className="w-2 h-2 bg-white rounded-sm" />}
                  </div>
                  <Folder className="w-4 h-4 flex-shrink-0" aria-hidden />
                  <span className="truncate">{directory}</span>
                </button>
                {onRenameDocumentRoot && (
                  <button
                    type="button"
                    aria-label={`Actions for ${directory}`}
                    title="Rename folder"
                    className="flex-shrink-0 p-2 rounded text-[var(--color-foreground)]/40 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                      window.setTimeout(() => {
                        setMenu({ dir: directory, x: r.left, y: r.bottom + 4 });
                      }, 0);
                    }}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {menu && onRenameDocumentRoot && (
        <SidebarRootMenu
          x={menu.x}
          y={menu.y}
          onRename={() => onRenameDocumentRoot(menu.dir)}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}
