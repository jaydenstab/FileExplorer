import { LayoutList, RefreshCw, Table2 } from 'lucide-react';
import type { ResultsViewMode } from './types';

interface ExplorerToolbarProps {
  viewMode: ResultsViewMode;
  onViewModeChange: (mode: ResultsViewMode) => void;
  resultCount: number;
  onRefresh?: () => void;
}

export function ExplorerToolbar({
  viewMode,
  onViewModeChange,
  resultCount,
  onRefresh,
}: ExplorerToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-2 py-2 flex-shrink-0">
      <p className="text-xs text-[var(--color-foreground)]/50 tabular-nums">
        {resultCount} item{resultCount !== 1 ? 's' : ''}
      </p>
      <div className="flex items-center gap-2">
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1.5 text-xs text-[var(--color-foreground)]/70 hover:bg-[var(--color-muted)]/50"
            title="Refresh results and recent files"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        )}
      <div
        className="flex rounded-md border border-[var(--color-border)] overflow-hidden"
        role="group"
        aria-label="Result layout"
      >
        <button
          type="button"
          onClick={() => onViewModeChange('details')}
          className={`px-2 py-1.5 text-xs flex items-center gap-1 transition-colors ${
            viewMode === 'details'
              ? 'bg-[var(--color-muted)] text-[var(--color-foreground)]'
              : 'text-[var(--color-foreground)]/60 hover:bg-[var(--color-muted)]/50'
          }`}
          title="Details view"
          aria-pressed={viewMode === 'details'}
        >
          <Table2 className="w-3.5 h-3.5" />
          Details
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange('list')}
          className={`px-2 py-1.5 text-xs flex items-center gap-1 border-l border-[var(--color-border)] transition-colors ${
            viewMode === 'list'
              ? 'bg-[var(--color-muted)] text-[var(--color-foreground)]'
              : 'text-[var(--color-foreground)]/60 hover:bg-[var(--color-muted)]/50'
          }`}
          title="List view"
          aria-pressed={viewMode === 'list'}
        >
          <LayoutList className="w-3.5 h-3.5" />
          List
        </button>
      </div>
      </div>
    </div>
  );
}
