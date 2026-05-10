import { memo } from 'react';
import { Folder, FileText, ExternalLink, MoreVertical } from 'lucide-react';
import type { FileItem } from './types';
import { formatRelevanceScore } from './types';

interface ResultRowProps {
  file: FileItem;
  onPreviewClick: (file: FileItem) => void;
  onOpenClick: (file: FileItem) => void;
  onMouseEnter: (file: FileItem) => void;
  showRerankScore?: boolean;
  isSelected?: boolean;
  onRenameRequest?: (file: FileItem) => void;
  /** Opens the actions menu at screen coordinates (right-click or overflow). */
  onOpenResultMenu?: (file: FileItem, clientX: number, clientY: number) => void;
  isResultMenuOpen?: boolean;
}

export const ResultRow = memo(
  ({
    file,
    onPreviewClick,
    onOpenClick,
    onMouseEnter,
    showRerankScore,
    isSelected,
    onRenameRequest,
    onOpenResultMenu,
    isResultMenuOpen,
  }: ResultRowProps) => {
    const canRename =
      Boolean(onOpenResultMenu && onRenameRequest) &&
      (file.type === 'file' || file.type === 'folder');

    return (
      <div
        data-result-row
        onMouseEnter={() => onMouseEnter(file)}
        onClick={() => onPreviewClick(file)}
        onDoubleClick={(e) => {
          if (file.type === 'file') {
            e.preventDefault();
            onOpenClick(file);
          }
        }}
        onContextMenu={(e) => {
          if (!canRename || !onOpenResultMenu) return;
          e.preventDefault();
          onOpenResultMenu(file, e.clientX, e.clientY);
        }}
        className={`group rounded-lg p-4 transition-all duration-200 cursor-pointer border ${
          isSelected
            ? 'bg-[var(--color-primary)]/15 border-[var(--color-primary)]/50 ring-1 ring-[var(--color-primary)]/25'
            : 'bg-[var(--color-card)] hover:bg-[var(--color-muted)] border-[var(--color-border)] hover:border-[var(--color-primary)]'
        }`}
      >
        <div className="flex items-start gap-3">
          {file.type === 'folder' ? (
            <Folder className="w-5 h-5 text-[var(--color-primary)] flex-shrink-0 mt-0.5" />
          ) : (
            <FileText className="w-5 h-5 text-[var(--color-foreground)]/70 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[var(--color-foreground)] group-hover:text-[var(--color-primary)] transition-colors mb-1 font-medium">
                    {file.name}
                  </h3>
                  {showRerankScore && file.rerankScore != null && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-muted)] text-[var(--color-foreground)]/70"
                      title="Relevance score (higher = better match)"
                    >
                      {formatRelevanceScore(file.rerankScore)}
                    </span>
                  )}
                </div>
                <p className="text-[var(--color-foreground)]/40 text-sm truncate font-mono">
                  {file.path}
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                {file.type === 'file' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenClick(file);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="open-os-button flex items-center gap-1 px-2 py-1 text-xs text-[var(--color-foreground)]/60 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded"
                    title="Open with system application (does not show in preview pane)"
                    aria-label="Open with system application (does not show in preview pane)"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
                {canRename && (
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={Boolean(isResultMenuOpen)}
                    aria-label={`Actions for ${file.name}`}
                    title="Actions"
                    className="p-1.5 rounded text-[var(--color-foreground)]/50 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!onOpenResultMenu) return;
                      const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                      onOpenResultMenu(file, r.left, r.bottom + 4);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ResultRow.displayName = 'ResultRow';
