import { FileText } from 'lucide-react';
import { SearchBar } from '../SearchBar';
import { AdvancedSearchPanel } from './AdvancedSearchPanel';
import { ResultsList } from './ResultsList';
import { ReindexButton } from './ReindexButton';
import { formatDirectoriesText, toApiPath } from './types';
import type { UseExplorerControllerResult } from './useExplorerController';

export interface ExplorerContentProps {
  controller: UseExplorerControllerResult;
}

export function ExplorerContent({ controller }: ExplorerContentProps) {
  const {
    searchQuery,
    handleSearch,
    minConfidence,
    setMinConfidence,
    distanceThreshold,
    setDistanceThreshold,
    useReranker,
    setUseReranker,
    selectedFileTypes,
    onFileTypeToggle,
    isDistanceInvalid,
    advancedExpanded,
    setAdvancedExpanded,
    handleResetFilters,
    searchResults,
    totalResults,
    hasNext,
    currentPage,
    isSearching,
    searchView,
    selectedDirectories,
    activeFiltersSummary,
    handleFileClick,
    prefetchPreview,
    handlePageChange,
    startReindexMutation,
    reindexStatus,
    handleReindex,
    reindexShowSuccess,
    errorMessage,
    showNoResultsError,
  } = controller;

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <SearchBar
            value={searchQuery}
            onChange={handleSearch}
            placeholder="Search files and folders..."
          />
        </div>

        <AdvancedSearchPanel
          expanded={advancedExpanded}
          onToggle={() => setAdvancedExpanded((p) => !p)}
          minConfidence={minConfidence}
          onMinConfidenceChange={setMinConfidence}
          distanceThreshold={distanceThreshold}
          onDistanceThresholdChange={setDistanceThreshold}
          useReranker={useReranker}
          onUseRerankerChange={setUseReranker}
          selectedFileTypes={selectedFileTypes}
          onFileTypeToggle={onFileTypeToggle}
          isDistanceInvalid={isDistanceInvalid}
          onResetFilters={handleResetFilters}
        />

        {isSearching && searchResults.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--color-border)] border-t-[var(--color-primary)]" />
          </div>
        )}

        {isSearching && searchResults.length > 0 && (
          <div className="flex items-center justify-center py-2 mb-4">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--color-border)] border-t-[var(--color-primary)]" />
          </div>
        )}

        <ReindexButton
          isPending={startReindexMutation.isPending || reindexStatus?.status === 'indexing'}
          showSuccess={reindexShowSuccess}
          onReindex={handleReindex}
        />

        {errorMessage && (
          <div className="mb-8 p-4 bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-lg">
            <p className="text-[var(--color-error)] text-center">{errorMessage}</p>
          </div>
        )}

        {showNoResultsError && (
          <div className="mb-8 p-4 bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-lg">
            <p className="text-[var(--color-error)] text-center">
              No files found matching your search in {formatDirectoriesText(selectedDirectories)}. If this is the first
              time searching these directories, try clicking &quot;Reindex Files&quot; to index
              them first.
            </p>
            {activeFiltersSummary && (
              <p className="text-sm text-[var(--color-foreground)]/50 text-center mt-2">
                Active filters: {activeFiltersSummary}
              </p>
            )}
          </div>
        )}

        {searchResults.length > 0 && (
          <ResultsList
            searchResults={searchResults}
            totalResults={totalResults}
            hasNext={hasNext}
            currentPage={currentPage}
            isSearching={isSearching}
            useReranker={useReranker}
            queryConfidenceScore={searchView?.queryConfidenceScore}
            queryConfidenceLevel={searchView?.queryConfidenceLevel}
            directoriesText={formatDirectoriesText(selectedDirectories)}
            activeFiltersSummary={activeFiltersSummary}
            onFilePreview={(file) => handleFileClick(file, 'preview')}
            onFileOpen={(file) => handleFileClick(file, 'open_os')}
            onFileHover={(file) => {
              if (file.type === 'file') prefetchPreview(toApiPath(file.path));
            }}
            onPageChange={handlePageChange}
          />
        )}

        {!searchQuery && !isSearching && searchResults.length === 0 && (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 text-[var(--color-foreground)]/20 mx-auto mb-4" />
            <p className="text-[var(--color-foreground)]/40">
              Start typing to search through files and folders in {formatDirectoriesText(selectedDirectories)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
