import { useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { searchFiles, openFile, type SearchResponse, type SearchOptions, type SearchResultItem, type PreviewData } from '../../lib/api';
import type { FileItem, SearchView } from './types';
import { resultToFileItem, buildSearchDescriptor } from './types';

export interface UseExplorerSearchParams {
  debouncedQuery: string;
  selectedDirectories: string[];
  searchOptions: SearchOptions;
  searchOptionsKey: string;
  pageSize: number;
  currentPage: number;
  setCurrentPage: (page: number | ((prev: number) => number)) => void;
}

export interface UseExplorerSearchResult {
  searchResults: FileItem[];
  hasNext: boolean;
  isSearching: boolean;
  searchError: Error | null;
  searchView: SearchView | undefined;
  totalResults: number;
  handlePageChange: (newPage: number) => void;
  prefetchPreview: (path: string) => void;
}

export function useExplorerSearch({
  debouncedQuery,
  selectedDirectories,
  searchOptions,
  searchOptionsKey,
  pageSize,
  currentPage,
  setCurrentPage,
}: UseExplorerSearchParams): UseExplorerSearchResult {
  const queryClient = useQueryClient();

  const searchDescriptor = useMemo(
    () =>
      buildSearchDescriptor({
        debouncedQuery,
        selectedDirectories,
        searchOptionsKey,
        currentPage,
        pageSize,
      }),
    [debouncedQuery, selectedDirectories, searchOptionsKey, currentPage, pageSize]
  );

  const {
    data: searchView,
    isFetching: isSearching,
    error: searchError,
  } = useQuery<SearchResponse, Error, SearchView>({
    queryKey: searchDescriptor.queryKey,
    queryFn: ({ signal }) =>
      searchFiles(debouncedQuery, selectedDirectories, currentPage, pageSize, searchOptions, signal),
    enabled: !!debouncedQuery.trim(),
    placeholderData: keepPreviousData,
    staleTime: 300_000,
    gcTime: 120_000,
    select: (data) => ({
      items: data.results.map((raw, index) => resultToFileItem(raw as string | SearchResultItem, index)),
      hasNext: data.has_next,
      page: data.page,
      pageSize: data.page_size,
      queryConfidenceScore: data.query_confidence_score,
      queryConfidenceLevel: data.query_confidence_level,
    }),
  });

  const searchResults: FileItem[] = searchView?.items || [];
  const hasNext = searchView?.hasNext || false;

  // Prefetch next page when available
  useEffect(() => {
    if (!debouncedQuery.trim() || !hasNext) return;
    const nextDescriptor = buildSearchDescriptor({
      debouncedQuery,
      selectedDirectories,
      searchOptionsKey,
      currentPage: currentPage + 1,
      pageSize,
    });
    queryClient.prefetchQuery({
      queryKey: nextDescriptor.queryKey,
      queryFn: ({ signal }) =>
        searchFiles(debouncedQuery, selectedDirectories, currentPage + 1, pageSize, searchOptions, signal),
      staleTime: 300_000,
      gcTime: 120_000,
    });
  }, [debouncedQuery, selectedDirectories, searchOptionsKey, searchOptions, currentPage, pageSize, hasNext, queryClient]);

  const totalResults = useMemo(() => {
    if (!searchView) return 0;
    if (hasNext) {
      return currentPage * pageSize + (searchResults.length > 0 ? 1 : 0);
    }
    return (currentPage - 1) * pageSize + searchResults.length;
  }, [searchView, hasNext, currentPage, pageSize, searchResults.length]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (newPage >= 1 && (!hasNext || newPage <= currentPage + 1)) {
        setCurrentPage(newPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [currentPage, hasNext]
  );

  const prefetchPreview = useCallback(
    (path: string) => {
      queryClient.prefetchQuery({
        queryKey: ['preview', path],
        queryFn: ({ signal }) => openFile(path, 'preview', signal) as Promise<PreviewData>,
        staleTime: 30_000,
      });
    },
    [queryClient]
  );

  return {
    searchResults,
    hasNext,
    isSearching,
    searchError: searchError ?? null,
    searchView,
    totalResults,
    handlePageChange,
    prefetchPreview,
  };
}
