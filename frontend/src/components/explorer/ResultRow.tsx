import { memo } from 'react';
import { Folder, FileText, ExternalLink } from 'lucide-react';
import type { FileItem } from './types';
import { formatRelevanceScore } from './types';

interface ResultRowProps {
  file: FileItem;
  onPreviewClick: (file: FileItem) => void;
  onOpenClick: (file: FileItem) => void;
  onMouseEnter: (file: FileItem) => void;
  showRerankScore?: boolean;
}

export const ResultRow = memo(({ file, onPreviewClick, onOpenClick, onMouseEnter, showRerankScore }: ResultRowProps) => {
  return (
    <div
      onMouseEnter={() => onMouseEnter(file)}
      onClick={() => onPreviewClick(file)}
      className="group bg-[var(--color-card)] hover:bg-[var(--color-muted)] border border-[var(--color-border)] hover:border-[var(--color-primary)] rounded-lg p-4 transition-all duration-200 cursor-pointer"
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
            {file.type === 'file' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenClick(file);
                }}
                className="open-os-button opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-2 py-1 text-xs text-[var(--color-foreground)]/60 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded"
                title="Open with system application (does not show in preview pane)"
                aria-label="Open with system application (does not show in preview pane)"
              >
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

ResultRow.displayName = 'ResultRow';
