import { useState, useCallback, useMemo, useEffect } from 'react';
import type { SearchOptions } from '../../lib/api';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import {
  DEFAULT_PAGE_SIZE,
  DISTANCE_MIN,
  DISTANCE_MAX,
  getActiveFiltersSummary,
  buildSearchOptionsKey,
  SEARCH_DEBOUNCE_MS,
  type ResultsViewMode,
} from './types';

interface UseExplorerStateParams {
  /** Top-level document directory names from GET /api/config/document-roots */
  documentRootDirs: string[];
}

interface UseExplorerStateResult {
  // Search
  searchQuery: string;
  debouncedQuery: string;
  handleSearch: (query: string) => void;

  // Results presentation (Windows Explorer–style item view)
  resultsViewMode: ResultsViewMode;
  setResultsViewMode: (v: ResultsViewMode | ((p: ResultsViewMode) => ResultsViewMode)) => void;
  selectedResultIndex: number | null;
  setSelectedResultIndex: (v: number | null | ((p: number | null) => number | null)) => void;

  // Directories
  selectedDirectories: string[];
  handleDirectoryToggle: (directory: string) => void;
  /** After renaming a document root on disk, map selection from old name to new. */
  replaceSelectedRootName: (fromName: string, toName: string) => void;

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

export function useExplorerState({ documentRootDirs }: UseExplorerStateParams): UseExplorerStateResult {
  const [searchQuery, setSearchQuery] = useState('');
  const isEmptyQuery = useCallback((q: string) => !q.trim(), []);
  const debouncedQuery = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS, {
    immediateWhen: isEmptyQuery,
  });
  const rootsKey = documentRootDirs.join('\0');
  const [selectedDirectories, setSelectedDirectories] = useState<string[]>(() =>
    documentRootDirs.length > 0 ? [documentRootDirs[0]] : []
  );
  const pageSize = DEFAULT_PAGE_SIZE;
  const [searchMode, setSearchModeState] = useState<'semantic' | 'text'>('semantic');
  const [minConfidence, setMinConfidenceState] = useState<'' | 'high' | 'medium' | 'low'>('');
  const [distanceThreshold, setDistanceThresholdState] = useState('');
  const [useReranker, setUseRerankerState] = useState(true);
  const [selectedFileTypes, setSelectedFileTypes] = useState<string[]>([]);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [resultsViewMode, setResultsViewMode] = useState<ResultsViewMode>('details');
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null);

  // API-driven roots changed: drop invalid selections (no discrete user action).
  useEffect(() => {
    if (documentRootDirs.length === 0) return;
    setSelectedDirectories((prev) => {
      const filtered = prev.filter((d) => documentRootDirs.includes(d));
      if (filtered.length > 0) return filtered;
      return [documentRootDirs[0]];
    });
  }, [rootsKey]);

  // Debounced query updates without a single "submit" handler—reset page when it changes.
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQuery]);

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

  const selectedDirectoriesKey = useMemo(() => selectedDirectories.slice().sort().join('\0'), [selectedDirectories]);

  const selectionResetKey = useMemo(
    () => [debouncedQuery, String(currentPage), searchMode, searchOptionsKey, selectedDirectoriesKey].join('|'),
    [debouncedQuery, currentPage, searchMode, searchOptionsKey, selectedDirectoriesKey]
  );

  // Result list identity changed—clear row selection (no single handler covers all triggers).
  useEffect(() => {
    setSelectedResultIndex(null);
  }, [selectionResetKey]);

  const setSearchMode = useCallback((value: 'semantic' | 'text') => {
    setSearchModeState(value);
    setCurrentPage(1);
  }, []);

  const setMinConfidence = useCallback((value: '' | 'high' | 'medium' | 'low') => {
    setMinConfidenceState(value);
    setCurrentPage(1);
  }, []);

  const setDistanceThreshold = useCallback((value: string) => {
    setDistanceThresholdState(value);
    setCurrentPage(1);
  }, []);

  const setUseReranker = useCallback((value: boolean) => {
    setUseRerankerState(value);
    setCurrentPage(1);
  }, []);

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

  const replaceSelectedRootName = useCallback((fromName: string, toName: string) => {
    setSelectedDirectories((prev) => prev.map((d) => (d === fromName ? toName : d)));
  }, []);

  const onFileTypeToggle = useCallback((ext: string) => {
    setSelectedFileTypes((prev) =>
      prev.includes(ext) ? prev.filter((x) => x !== ext) : [...prev, ext]
    );
    setCurrentPage(1);
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
    resultsViewMode,
    setResultsViewMode,
    selectedResultIndex,
    setSelectedResultIndex,
    selectedDirectories,
    handleDirectoryToggle,
    replaceSelectedRootName,
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
