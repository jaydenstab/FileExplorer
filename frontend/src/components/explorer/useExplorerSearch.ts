import { useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { searchFiles, openPreview, type SearchResponse, type SearchOptions, type SearchResultItem } from '../../lib/api';
import type { FileItem, SearchView } from './types';
import { resultToFileItem, buildSearchDescriptor } from './types';

const HOVER_PREFETCH_DELAY_MS = 150;

interface UseExplorerSearchParams {
  debouncedQuery: string;
  selectedDirectories: string[];
  searchOptions: SearchOptions;
  searchOptionsKey: string;
  pageSize: number;
  currentPage: number;
  setCurrentPage: (page: number | ((prev: number) => number)) => void;
}

interface UseExplorerSearchResult {
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
  const prefetchTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (prefetchTimeoutRef.current) window.clearTimeout(prefetchTimeoutRef.current);
    };
  }, []); // hover prefetch debounce cleanup

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

  const searchStaleTime = useMemo(
    () => (searchOptions.searchMode === 'text' ? 60_000 : 300_000),
    [searchOptions.searchMode]
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
    staleTime: searchStaleTime,
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

  // Warm next page in the cache when the user might paginate (not a fetch-on-mount anti-pattern).
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
      staleTime: searchStaleTime,
      gcTime: 120_000,
    });
  }, [
    debouncedQuery,
    selectedDirectories,
    searchOptionsKey,
    searchOptions,
    currentPage,
    pageSize,
    hasNext,
    queryClient,
    searchStaleTime,
  ]);

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
    [currentPage, hasNext, setCurrentPage]
  );

  const prefetchPreview = useCallback(
    (path: string) => {
      // Skip prefetch for PDFs - they load via /api/file when displayed; avoid eager text extraction
      if (path.toLowerCase().endsWith('.pdf')) return;
      if (prefetchTimeoutRef.current) window.clearTimeout(prefetchTimeoutRef.current);
      prefetchTimeoutRef.current = window.setTimeout(() => {
        prefetchTimeoutRef.current = null;
        queryClient.prefetchQuery({
          queryKey: ['preview', path],
          queryFn: ({ signal }) => openPreview(path, signal),
          staleTime: 30_000,
        });
      }, HOVER_PREFETCH_DELAY_MS);
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
