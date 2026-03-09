import { RotateCw, CheckCircle2 } from 'lucide-react';

export interface ReindexButtonProps {
  isPending: boolean;
  showSuccess: boolean;
  onReindex: () => void;
}

export function ReindexButton({ isPending, showSuccess, onReindex }: ReindexButtonProps) {
  return (
    <div className="flex items-center justify-center gap-4 mb-8">
      <button
        onClick={onReindex}
        disabled={isPending}
        className="flex items-center gap-2 px-6 py-3 bg-[var(--color-card)] hover:bg-[var(--color-primary)]/20 disabled:bg-[var(--color-muted)] disabled:cursor-not-allowed text-[var(--color-foreground)] rounded-lg transition-all duration-200 border border-[var(--color-border)] hover:border-[var(--color-primary)]"
      >
        <RotateCw
          className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`}
        />
        {isPending ? 'Reindexing...' : 'Reindex Files'}
      </button>

      {showSuccess && (
        <div className="flex items-center gap-2 text-[var(--color-success)] animate-in fade-in slide-in-from-left-2 duration-300">
          <CheckCircle2 className="w-5 h-5" />
          <span> Completed!</span>
        </div>
      )}
    </div>
  );
}
