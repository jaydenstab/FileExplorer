import { useCallback, type KeyboardEvent } from 'react';
import { FileText } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { SearchBar } from '../SearchBar';
import { AdvancedSearchPanel } from './AdvancedSearchPanel';
import { ResultsList } from './ResultsList';
import { ReindexButton } from './ReindexButton';
import { BreadcrumbAddress } from './BreadcrumbAddress';
import { ExplorerToolbar } from './ExplorerToolbar';
import { RenameFileDialog } from './RenameFileDialog';
import { formatDirectoriesText, toApiPath } from './types';
import type { FileItem } from './types';
import type { UseExplorerControllerResult } from './useExplorerController';

interface ExplorerContentProps {
  controller: UseExplorerControllerResult;
}

export function ExplorerContent({ controller }: ExplorerContentProps) {
  const { filters, search, reindex, preview, feedback, shell, rename } = controller;
  const queryClient = useQueryClient();

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

  const handleResultsKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const rows = search.searchResults;
      if (rows.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const prev = shell.selectedResultIndex;
        const next = prev == null ? 0 : Math.min(prev + 1, rows.length - 1);
        shell.setSelectedResultIndex(next);
        onFilePreview(rows[next]);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = shell.selectedResultIndex;
        const next = prev == null ? rows.length - 1 : Math.max(prev - 1, 0);
        shell.setSelectedResultIndex(next);
        onFilePreview(rows[next]);
        return;
      }
      if (e.key === 'Enter') {
        const idx = shell.selectedResultIndex;
        if (idx != null && rows[idx]) {
          e.preventDefault();
          onFilePreview(rows[idx]);
        }
        return;
      }
      if (e.key === 'F2') {
        const idx = shell.selectedResultIndex ?? 0;
        const f = rows[idx];
        if (f?.type === 'file' || f?.type === 'folder') {
          e.preventDefault();
          rename.openDialog(f);
        }
      }
    },
    [
      search.searchResults,
      shell.selectedResultIndex,
      shell.setSelectedResultIndex,
      onFilePreview,
      rename.openDialog,
    ]
  );

  const handleToolbarRefresh = useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'search',
    });
    void controller.recent.refetch();
  }, [queryClient, controller.recent]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0">
        <div className="w-full max-w-none mx-auto flex flex-col min-h-0">
          <div className="mb-3">
            <SearchBar
              value={filters.searchQuery}
              onChange={filters.handleSearch}
              placeholder="Search files and folders..."
            />
          </div>

          <BreadcrumbAddress
            searchQuery={filters.searchQuery}
            selectedDirectories={filters.selectedDirectories}
          />

          <AdvancedSearchPanel
            expanded={filters.advancedExpanded}
            onToggle={() => filters.setAdvancedExpanded((p) => !p)}
            searchMode={filters.searchMode}
            onSearchModeChange={filters.setSearchMode}
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
            <div className="flex items-center justify-center py-2 mb-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--color-border)] border-t-[var(--color-primary)]" />
            </div>
          )}

          <ReindexButton
            isPending={reindex.startReindexMutation.isPending || reindex.reindexStatus?.status === 'indexing'}
            showSuccess={feedback.reindexShowSuccess}
            onReindex={reindex.handleReindex}
          />

          {rename.indexWarning && (
            <div
              className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-[var(--color-foreground)]"
              role="status"
            >
              <p className="min-w-0 flex-1">{rename.indexWarning}</p>
              <button
                type="button"
                onClick={rename.clearIndexWarning}
                className="flex-shrink-0 rounded border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-muted)]"
              >
                Dismiss
              </button>
            </div>
          )}

          {feedback.errorMessage && (
            <div className="mb-6 p-4 bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-lg">
              <p className="text-[var(--color-error)] text-center">{feedback.errorMessage}</p>
            </div>
          )}

          {feedback.showNoResultsError && (
            <div className="mb-6 p-4 bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-lg">
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
            <>
              <ExplorerToolbar
                viewMode={shell.resultsViewMode}
                onViewModeChange={shell.setResultsViewMode}
                resultCount={search.searchResults.length}
                onRefresh={handleToolbarRefresh}
              />
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
                viewMode={shell.resultsViewMode}
                selectedIndex={shell.selectedResultIndex}
                onSelectIndex={shell.setSelectedResultIndex}
                onFilePreview={onFilePreview}
                onFileOpen={onFileOpen}
                onFileHover={onFileHover}
                onPageChange={search.handlePageChange}
                onRenameRequest={rename.openDialog}
                onContainerKeyDown={handleResultsKeyDown}
              />
            </>
          )}

          {!filters.searchQuery && !search.isSearching && search.searchResults.length === 0 && (
            <div className="text-center py-16 max-w-xl mx-auto">
              <FileText className="w-16 h-16 text-[var(--color-foreground)]/20 mx-auto mb-4" />
              <p className="text-[var(--color-foreground)]/40">
                Start typing to search through files and folders in {formatDirectoriesText(filters.selectedDirectories)}
              </p>
            </div>
          )}
        </div>
      </div>

      <RenameFileDialog
        file={rename.dialogFile}
        onClose={rename.closeDialog}
        onConfirm={rename.confirm}
        pending={rename.pending}
        errorMessage={rename.errorMessage}
      />
    </div>
  );
}
