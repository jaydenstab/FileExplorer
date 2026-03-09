import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationControlsProps {
  currentPage: number;
  hasNext: boolean;
  isSearching: boolean;
  onPageChange: (newPage: number) => void;
}

export function PaginationControls({
  currentPage,
  hasNext,
  isSearching,
  onPageChange,
}: PaginationControlsProps) {
  return (
    <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border)]">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1 || isSearching}
        className="flex items-center gap-1 px-4 py-2 text-sm text-[var(--color-foreground)] disabled:text-[var(--color-foreground)]/30 disabled:cursor-not-allowed hover:bg-[var(--color-muted)] rounded-lg transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Previous
      </button>

      <span className="text-sm text-[var(--color-foreground)]/60">
        Page {currentPage}
      </span>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!hasNext || isSearching}
        className="flex items-center gap-1 px-4 py-2 text-sm text-[var(--color-foreground)] disabled:text-[var(--color-foreground)]/30 disabled:cursor-not-allowed hover:bg-[var(--color-muted)] rounded-lg transition-colors"
      >
        Next
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
