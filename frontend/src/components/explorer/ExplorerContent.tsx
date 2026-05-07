import { useCallback } from 'react';
import { FileText } from 'lucide-react';
import { SearchBar } from '../SearchBar';
import { AdvancedSearchPanel } from './AdvancedSearchPanel';
import { ResultsList } from './ResultsList';
import { ReindexButton } from './ReindexButton';
import { formatDirectoriesText, toApiPath } from './types';
import type { FileItem } from './types';
import type { UseExplorerControllerResult } from './useExplorerController';

interface ExplorerContentProps {
  controller: UseExplorerControllerResult;
}

export function ExplorerContent({ controller }: ExplorerContentProps) {
  const { filters, search, reindex, preview, feedback } = controller;

  const onFilePreview = useCallback(
    (file: FileItem) => preview.handleFileClick(file, 'preview'),
    [preview.handleFileClick]
  );
  const onFileOpen = useCallback(
    (file: FileItem) => preview.handleFileClick(file, 'open_os'),
    [preview.handleFileClick]
  );
  const onFileHover = useCallback(
    (file: FileItem) => {
      if (file.type === 'file') search.prefetchPreview(toApiPath(file.path));
    },
    [search.prefetchPreview]
  );

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <SearchBar
            value={filters.searchQuery}
            onChange={filters.handleSearch}
            placeholder="Search files and folders..."
          />
        </div>

        <AdvancedSearchPanel
          expanded={filters.advancedExpanded}
          onToggle={() => filters.setAdvancedExpanded((p) => !p)}
          minConfidence={filters.minConfidence}
          onMinConfidenceChange={filters.setMinConfidence}
          distanceThreshold={filters.distanceThreshold}
          onDistanceThresholdChange={filters.setDistanceThreshold}
          useReranker={filters.useReranker}
          onUseRerankerChange={filters.setUseReranker}
          selectedFileTypes={filters.selectedFileTypes}
          onFileTypeToggle={filters.onFileTypeToggle}
          isDistanceInvalid={filters.isDistanceInvalid}
          onResetFilters={filters.handleResetFilters}
        />

        {search.isSearching && search.searchResults.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--color-border)] border-t-[var(--color-primary)]" />
          </div>
        )}

        {search.isSearching && search.searchResults.length > 0 && (
          <div className="flex items-center justify-center py-2 mb-4">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--color-border)] border-t-[var(--color-primary)]" />
          </div>
        )}

        <ReindexButton
          isPending={reindex.startReindexMutation.isPending || reindex.reindexStatus?.status === 'indexing'}
          showSuccess={feedback.reindexShowSuccess}
          onReindex={reindex.handleReindex}
        />

        {feedback.errorMessage && (
          <div className="mb-8 p-4 bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-lg">
            <p className="text-[var(--color-error)] text-center">{feedback.errorMessage}</p>
          </div>
        )}

        {feedback.showNoResultsError && (
          <div className="mb-8 p-4 bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-lg">
            <p className="text-[var(--color-error)] text-center">
              No files found matching your search in {formatDirectoriesText(filters.selectedDirectories)}. If this is the first
              time searching these directories, try clicking &quot;Reindex Files&quot; to index
              them first.
            </p>
            {filters.activeFiltersSummary && (
              <p className="text-sm text-[var(--color-foreground)]/50 text-center mt-2">
                Active filters: {filters.activeFiltersSummary}
              </p>
            )}
          </div>
        )}

        {search.searchResults.length > 0 && (
          <ResultsList
            searchResults={search.searchResults}
            totalResults={search.totalResults}
            hasNext={search.hasNext}
            currentPage={filters.currentPage}
            isSearching={search.isSearching}
            useReranker={filters.useReranker}
            queryConfidenceScore={search.searchView?.queryConfidenceScore}
            queryConfidenceLevel={search.searchView?.queryConfidenceLevel}
            directoriesText={formatDirectoriesText(filters.selectedDirectories)}
            activeFiltersSummary={filters.activeFiltersSummary}
            onFilePreview={onFilePreview}
            onFileOpen={onFileOpen}
            onFileHover={onFileHover}
            onPageChange={search.handlePageChange}
          />
        )}

        {!filters.searchQuery && !search.isSearching && search.searchResults.length === 0 && (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 text-[var(--color-foreground)]/20 mx-auto mb-4" />
            <p className="text-[var(--color-foreground)]/40">
              Start typing to search through files and folders in {formatDirectoriesText(filters.selectedDirectories)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
