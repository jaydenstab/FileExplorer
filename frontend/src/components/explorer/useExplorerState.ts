import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { SearchOptions } from '../../lib/api';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import {
  DEFAULT_PAGE_SIZE,
  AVAILABLE_DIRECTORIES,
  DISTANCE_MIN,
  DISTANCE_MAX,
  getActiveFiltersSummary,
  buildSearchOptionsKey,
  SEARCH_DEBOUNCE_MS,
} from './types';

interface UseExplorerStateResult {
  // Search
  searchQuery: string;
  debouncedQuery: string;
  handleSearch: (query: string) => void;

  // Directories
  selectedDirectories: string[];
  handleDirectoryToggle: (directory: string) => void;

  // Search mode
  searchMode: 'semantic' | 'text';
  setSearchMode: (value: 'semantic' | 'text') => void;

  // Filters
  minConfidence: '' | 'high' | 'medium' | 'low';
  setMinConfidence: (value: '' | 'high' | 'medium' | 'low') => void;
  distanceThreshold: string;
  setDistanceThreshold: (value: string) => void;
  useReranker: boolean;
  setUseReranker: (value: boolean) => void;
  selectedFileTypes: string[];
  onFileTypeToggle: (ext: string) => void;
  isDistanceInvalid: boolean;

  // UI
  advancedExpanded: boolean;
  setAdvancedExpanded: (value: boolean | ((prev: boolean) => boolean)) => void;

  // Pagination (owned here so reset rules live in one place)
  currentPage: number;
  setCurrentPage: (page: number | ((prev: number) => number)) => void;

  // Derived
  searchOptions: SearchOptions;
  searchOptionsKey: string;
  activeFiltersSummary: string | null;
  pageSize: number;

  // Handlers
  handleResetFilters: () => void;
}

export function useExplorerState(): UseExplorerStateResult {
  const [searchQuery, setSearchQuery] = useState('');
  const isEmptyQuery = useCallback((q: string) => !q.trim(), []);
  const debouncedQuery = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS, {
    immediateWhen: isEmptyQuery,
  });
  const [selectedDirectories, setSelectedDirectories] = useState<string[]>([AVAILABLE_DIRECTORIES[0]]);
  const pageSize = DEFAULT_PAGE_SIZE;
  const [searchMode, setSearchMode] = useState<'semantic' | 'text'>('semantic');
  const [minConfidence, setMinConfidence] = useState<'' | 'high' | 'medium' | 'low'>('');
  const [distanceThreshold, setDistanceThreshold] = useState('');
  const [useReranker, setUseReranker] = useState(true);
  const [selectedFileTypes, setSelectedFileTypes] = useState<string[]>([]);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const prevSearchOptionsKeyRef = useRef<string | null>(null);

  // Reset page when debounced query changes (query or filters)
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchMode]);

  const searchOptions = useMemo((): SearchOptions => {
    const opts: SearchOptions = { useReranker, searchMode };
    if (minConfidence) opts.minConfidence = minConfidence;
    const dist = parseFloat(distanceThreshold);
    if (!Number.isNaN(dist) && dist >= DISTANCE_MIN && dist <= DISTANCE_MAX) {
      opts.distanceThreshold = Math.max(DISTANCE_MIN, Math.min(DISTANCE_MAX, dist));
    }
    if (selectedFileTypes.length > 0) opts.fileTypes = [...selectedFileTypes].sort();
    return opts;
  }, [minConfidence, distanceThreshold, useReranker, selectedFileTypes, searchMode]);

  const distanceNum = parseFloat(distanceThreshold);
  const isDistanceInvalid =
    distanceThreshold.trim() !== '' &&
    (Number.isNaN(distanceNum) || distanceNum < DISTANCE_MIN || distanceNum > DISTANCE_MAX);

  const searchOptionsKey = useMemo(
    () =>
      buildSearchOptionsKey({
        searchMode,
        minConfidence,
        distanceThreshold,
        useReranker,
        selectedFileTypes,
      }),
    [searchMode, minConfidence, distanceThreshold, useReranker, selectedFileTypes]
  );

  // Reset pagination when filters change (skip initial mount)
  useEffect(() => {
    if (prevSearchOptionsKeyRef.current !== null && prevSearchOptionsKeyRef.current !== searchOptionsKey) {
      setCurrentPage(1);
    }
    prevSearchOptionsKeyRef.current = searchOptionsKey;
  }, [searchOptionsKey]);

  const activeFiltersSummary = useMemo(
    () =>
      getActiveFiltersSummary({
        searchMode,
        minConfidence,
        distanceThreshold,
        isDistanceInvalid,
        useReranker,
        selectedFileTypes,
      }),
    [searchMode, minConfidence, distanceThreshold, isDistanceInvalid, useReranker, selectedFileTypes]
  );

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleDirectoryToggle = useCallback((directory: string) => {
    setSelectedDirectories((prev) => {
      const isSelected = prev.includes(directory);
      return isSelected ? prev.filter((d) => d !== directory) : [...prev, directory];
    });
    setCurrentPage(1);
  }, []);

  const onFileTypeToggle = useCallback((ext: string) => {
    setSelectedFileTypes((prev) =>
      prev.includes(ext) ? prev.filter((x) => x !== ext) : [...prev, ext]
    );
  }, []);

  const handleResetFilters = useCallback(() => {
    setSearchMode('semantic');
    setMinConfidence('');
    setDistanceThreshold('');
    setUseReranker(true);
    setSelectedFileTypes([]);
    setCurrentPage(1);
  }, []);

  return {
    searchQuery,
    debouncedQuery,
    handleSearch,
    selectedDirectories,
    handleDirectoryToggle,
    searchMode,
    setSearchMode,
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
    currentPage,
    setCurrentPage,
    searchOptions,
    searchOptionsKey,
    activeFiltersSummary,
    pageSize,
    handleResetFilters,
  };
}
