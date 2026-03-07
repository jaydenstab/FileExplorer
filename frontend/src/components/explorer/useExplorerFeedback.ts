import { useState, useEffect, useRef, useMemo } from 'react';
import type { StatusState } from '../StatusBar';
import type { FileItem } from './types';

export interface UseExplorerFeedbackParams {
  search: {
    isSearching: boolean;
    debouncedQuery: string;
    searchResults: FileItem[];
    searchError: Error | null;
  };
  reindex: {
    statusContribution: StatusState | null;
    reindexComplete: boolean;
    localError: string | null;
    startReindexMutation: { error: unknown };
    reindexStatus: { status: string; error?: string } | undefined;
    reindexStatusError: Error | null;
  };
  preview: {
    statusContribution: StatusState | null;
    openSuccess: boolean;
    openFileMutation: { error: unknown };
  };
}

export interface UseExplorerFeedbackResult {
  status: StatusState;
  reindexShowSuccess: boolean;
  errorMessage: string | null;
  showNoResultsError: boolean;
}

export function useExplorerFeedback({
  search,
  reindex,
  preview,
}: UseExplorerFeedbackParams): UseExplorerFeedbackResult {
  const [searchStatusContribution, setSearchStatusContribution] = useState<StatusState | null>(null);
  const searchStatusTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (search.isSearching && search.debouncedQuery.trim()) {
      setSearchStatusContribution({
        type: 'search',
        message: `Searching for "${search.debouncedQuery}"...`,
      });
    } else if (!search.isSearching && searchStatusContribution?.type === 'search') {
      if (searchStatusTimeoutRef.current) window.clearTimeout(searchStatusTimeoutRef.current);
      searchStatusTimeoutRef.current = window.setTimeout(() => setSearchStatusContribution(null), 300);
    }
  }, [search.isSearching, search.debouncedQuery, searchStatusContribution?.type]);

  useEffect(() => {
    return () => {
      if (searchStatusTimeoutRef.current) window.clearTimeout(searchStatusTimeoutRef.current);
    };
  }, []);

  const status = useMemo((): StatusState => {
    const c =
      searchStatusContribution ?? reindex.statusContribution ?? preview.statusContribution;
    return c ?? { type: null, message: '' };
  }, [searchStatusContribution, reindex.statusContribution, preview.statusContribution]);

  const reindexShowSuccess = reindex.reindexComplete;

  const errorMessage =
    reindex.localError ||
    (search.searchError instanceof Error ? search.searchError.message : null) ||
    (preview.openFileMutation.error instanceof Error
      ? preview.openFileMutation.error.message
      : null) ||
    (reindex.startReindexMutation.error instanceof Error
      ? reindex.startReindexMutation.error.message
      : null) ||
    (reindex.reindexStatusError instanceof Error ? reindex.reindexStatusError.message : null) ||
    (reindex.reindexStatus?.status === 'error' && reindex.reindexStatus.error
      ? reindex.reindexStatus.error
      : null);

  const showNoResultsError =
    !search.isSearching &&
    search.debouncedQuery.trim() &&
    search.searchResults.length === 0 &&
    !search.searchError;

  return {
    status,
    reindexShowSuccess,
    errorMessage,
    showNoResultsError,
  };
}
