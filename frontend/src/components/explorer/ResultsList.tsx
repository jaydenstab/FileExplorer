import type { FileItem } from './types';
import { formatRelevanceScore } from './types';
import { ResultRow } from './ResultRow';
import { PaginationControls } from './PaginationControls';

interface ResultsListProps {
  searchResults: FileItem[];
  totalResults: number;
  hasNext: boolean;
  currentPage: number;
  isSearching: boolean;
  useReranker: boolean;
  queryConfidenceScore?: number;
  queryConfidenceLevel?: 'low' | 'medium' | 'high';
  directoriesText: string;
  activeFiltersSummary: string | null;
  onFilePreview: (file: FileItem) => void;
  onFileOpen: (file: FileItem) => void;
  onFileHover: (file: FileItem) => void;
  onPageChange: (newPage: number) => void;
}

export function ResultsList({
  searchResults,
  totalResults,
  hasNext,
  currentPage,
  isSearching,
  useReranker,
  queryConfidenceScore,
  queryConfidenceLevel,
  directoriesText,
  activeFiltersSummary,
  onFilePreview,
  onFileOpen,
  onFileHover,
  onPageChange,
}: ResultsListProps) {
  const displayCount = totalResults > 0 ? totalResults : searchResults.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[var(--color-foreground)]/60">
            Found {displayCount} result{displayCount !== 1 ? 's' : ''} in {directoriesText}
          </p>
          {useReranker && queryConfidenceScore != null && queryConfidenceLevel && (
            <span
              className="text-xs px-2 py-1 rounded-lg bg-[var(--color-muted)] text-[var(--color-foreground)]/70"
              title="Overall query relevance from reranker (higher = better match)"
            >
              Query relevance: {queryConfidenceLevel} ({formatRelevanceScore(queryConfidenceScore)})
            </span>
          )}
        </div>
        {activeFiltersSummary && (
          <p className="text-xs text-[var(--color-foreground)]/50">
            {activeFiltersSummary}
          </p>
        )}
      </div>

      <div className="space-y-2">
        {searchResults.map((file) => (
          <ResultRow
            key={file.id}
            file={file}
            onPreviewClick={onFilePreview}
            onOpenClick={onFileOpen}
            onMouseEnter={onFileHover}
            showRerankScore={useReranker}
          />
        ))}
      </div>

      <PaginationControls
        currentPage={currentPage}
        hasNext={hasNext}
        isSearching={isSearching}
        onPageChange={onPageChange}
      />
    </div>
  );
}
