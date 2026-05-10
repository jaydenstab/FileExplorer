import { useCallback, useState, type KeyboardEvent } from 'react';
import type { FileItem, ResultsViewMode } from './types';
import { formatRelevanceScore } from './types';
import { ResultRow } from './ResultRow';
import { PaginationControls } from './PaginationControls';
import { ResultsDetailsTable } from './ResultsDetailsTable';
import { SearchResultContextMenu } from './SearchResultContextMenu';

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
  viewMode: ResultsViewMode;
  selectedIndex: number | null;
  onSelectIndex: (index: number | null) => void;
  onFilePreview: (file: FileItem) => void;
  onFileOpen: (file: FileItem) => void;
  onFileHover: (file: FileItem) => void;
  onPageChange: (newPage: number) => void;
  onRenameRequest?: (file: FileItem) => void;
  onContainerKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
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
  viewMode,
  selectedIndex,
  onSelectIndex,
  onFilePreview,
  onFileOpen,
  onFileHover,
  onPageChange,
  onRenameRequest,
  onContainerKeyDown,
}: ResultsListProps) {
  const displayCount = totalResults > 0 ? totalResults : searchResults.length;
  const [contextMenu, setContextMenu] = useState<{
    file: FileItem;
    x: number;
    y: number;
  } | null>(null);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const openResultMenu = useCallback((file: FileItem, clientX: number, clientY: number) => {
    setContextMenu({ file, x: clientX, y: clientY });
  }, []);

  const listboxAria =
    onRenameRequest && searchResults.length > 0
      ? 'Search results. Use arrow keys to move, Enter to preview, fn+F2 to rename, or the row actions menu.'
      : 'Search results. Use arrow keys to move, Enter to preview.';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
          <p className="text-[var(--color-foreground)]/60">
            Found {displayCount} result{displayCount !== 1 ? 's' : ''} in {directoriesText}
          </p>
          {onRenameRequest && searchResults.length > 0 && (
            <p className="text-xs text-[var(--color-foreground)]/45 max-w-xl">
              Rename: use the row ⋮ button, right-click the row, or fn+F2 (Mac).
            </p>
          )}
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

      <div
        role="listbox"
        aria-label={listboxAria}
        tabIndex={0}
        onKeyDown={onContainerKeyDown}
        className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]"
      >
        {viewMode === 'details' ? (
          <ResultsDetailsTable
            files={searchResults}
            selectedIndex={selectedIndex}
            onSelectIndex={onSelectIndex}
            onPreview={onFilePreview}
            onOpenOs={onFileOpen}
            onHover={onFileHover}
            showRerankScore={useReranker}
            onRenameRequest={onRenameRequest}
            onOpenResultMenu={onRenameRequest ? openResultMenu : undefined}
            openMenuFileId={contextMenu?.file.id ?? null}
          />
        ) : (
          <div className="space-y-2">
            {searchResults.map((file, index) => (
              <ResultRow
                key={file.id}
                file={file}
                isSelected={selectedIndex === index}
                onPreviewClick={(f) => {
                  onSelectIndex(index);
                  onFilePreview(f);
                }}
                onOpenClick={onFileOpen}
                onMouseEnter={onFileHover}
                showRerankScore={useReranker}
                onRenameRequest={onRenameRequest}
                onOpenResultMenu={onRenameRequest ? openResultMenu : undefined}
                isResultMenuOpen={contextMenu?.file.id === file.id}
              />
            ))}
          </div>
        )}
      </div>

      {contextMenu && onRenameRequest && (
        <SearchResultContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          kind={contextMenu.file.type === 'folder' ? 'folder' : 'file'}
          onRename={() => {
            onRenameRequest(contextMenu.file);
            setContextMenu(null);
          }}
          onClose={closeContextMenu}
        />
      )}

      <PaginationControls
        currentPage={currentPage}
        hasNext={hasNext}
        isSearching={isSearching}
        onPageChange={onPageChange}
      />
    </div>
  );
}
