import { Loader2 } from 'lucide-react';

export interface StatusState {
  type: 'search' | 'reindex' | 'preview' | 'open' | null;
  message: string;
  progress?: {
    current: number;
    total: number;
    percent: number;
    currentFile?: string;
    phase?: string;
  };
}

interface StatusBarProps {
  status: StatusState;
}

export function StatusBar({ status }: StatusBarProps) {
  // Don't render if no active operation
  if (!status.type) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-40 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-lg p-3 min-w-[280px] max-w-[400px]">
        {/* Simple status message (for search, preview, open) */}
        {status.type !== 'reindex' && (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-[var(--color-primary)] animate-spin flex-shrink-0" />
            <span className="text-sm text-[var(--color-foreground)] truncate">
              {status.message}
            </span>
          </div>
        )}

        {/* Detailed progress bar (for reindex) */}
        {status.type === 'reindex' && status.progress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--color-foreground)] truncate">
                {status.message}
              </span>
              <span className="text-xs text-[var(--color-foreground)]/60 flex-shrink-0 ml-2">
                {status.progress.percent.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-[var(--color-muted)] rounded-full h-1.5">
              <div
                className="bg-[var(--color-primary)] h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${status.progress.percent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-[var(--color-foreground)]/60">
              <span className="truncate max-w-[200px]">
                {status.progress.currentFile && (
                  <span className="truncate">
                    {status.progress.currentFile.split('/').pop()}
                  </span>
                )}
              </span>
              <span className="flex-shrink-0 ml-2">
                {status.progress.current} / {status.progress.total} files
              </span>
            </div>
            {status.progress.phase && (
              <div className="text-xs text-[var(--color-foreground)]/40">
                Phase: {status.progress.phase}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

