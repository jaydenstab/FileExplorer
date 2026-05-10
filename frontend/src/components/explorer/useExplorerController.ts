import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { StatusState } from '../StatusBar';
import { useExplorerState } from './useExplorerState';
import { useExplorerSearch } from './useExplorerSearch';
import { useReindexStatus } from './useReindexStatus';
import { usePreviewPanel } from './usePreviewPanel';
import { useExplorerFeedback } from './useExplorerFeedback';
import { useExplorerRename, type ExplorerRename } from './useExplorerRename';
import { fetchDocumentRoots } from '../../lib/api';
import { useRecentFiles } from './useRecentFiles';
import type { ResultsViewMode } from './types';
import type { FileItem } from './types';

export type { ExplorerRename } from './useExplorerRename';

export interface ExplorerFilters {
  searchQuery: string;
  handleSearch: (query: string) => void;
  selectedDirectories: string[];
  handleDirectoryToggle: (directory: string) => void;
  searchMode: 'semantic' | 'text';
  setSearchMode: (v: 'semantic' | 'text') => void;
  minConfidence: '' | 'high' | 'medium' | 'low';
  setMinConfidence: (v: '' | 'high' | 'medium' | 'low') => void;
  distanceThreshold: string;
  setDistanceThreshold: (v: string) => void;
  useReranker: boolean;
  setUseReranker: (v: boolean) => void;
  selectedFileTypes: string[];
  onFileTypeToggle: (ext: string) => void;
  isDistanceInvalid: boolean;
  advancedExpanded: boolean;
  setAdvancedExpanded: (v: boolean | ((p: boolean) => boolean)) => void;
  currentPage: number;
  activeFiltersSummary: string | null;
  handleResetFilters: () => void;
}

export interface ExplorerSearch {
  searchResults: ReturnType<typeof useExplorerSearch>['searchResults'];
  hasNext: boolean;
  isSearching: boolean;
  searchView: ReturnType<typeof useExplorerSearch>['searchView'];
  totalResults: number;
  handlePageChange: (newPage: number) => void;
  prefetchPreview: (path: string) => void;
}

export interface ExplorerReindex {
  startReindexMutation: ReturnType<typeof useReindexStatus>['startReindexMutation'];
  reindexStatus: ReturnType<typeof useReindexStatus>['reindexStatus'];
  handleReindex: () => void;
}

export interface ExplorerPreview {
  previewData: ReturnType<typeof usePreviewPanel>['previewData'];
  previewError: ReturnType<typeof usePreviewPanel>['previewError'];
  previewErrorPath: ReturnType<typeof usePreviewPanel>['previewErrorPath'];
  isClosing: ReturnType<typeof usePreviewPanel>['isClosing'];
  isPreviewLoading: ReturnType<typeof usePreviewPanel>['isPreviewLoading'];
  handleFileClick: ReturnType<typeof usePreviewPanel>['handleFileClick'];
  openPathWithSystem: ReturnType<typeof usePreviewPanel>['openPathWithSystem'];
  closePreview: () => void;
}

export interface ExplorerFeedback {
  status: StatusState;
  reindexShowSuccess: boolean;
  errorMessage: string | null;
  showNoResultsError: boolean;
}

export interface ExplorerShell {
  resultsViewMode: ResultsViewMode;
  setResultsViewMode: (v: ResultsViewMode | ((p: ResultsViewMode) => ResultsViewMode)) => void;
  selectedResultIndex: number | null;
  setSelectedResultIndex: (v: number | null | ((p: number | null) => number | null)) => void;
}

export interface ExplorerRecent {
  files: FileItem[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface UseExplorerControllerResult {
  /** Persisted document root names (sidebar scope). */
  documentRoots: string[];
  filters: ExplorerFilters;
  search: ExplorerSearch;
  reindex: ExplorerReindex;
  preview: ExplorerPreview;
  feedback: ExplorerFeedback;
  shell: ExplorerShell;
  recent: ExplorerRecent;
  rename: ExplorerRename;
}

export function useExplorerController(): UseExplorerControllerResult {
  const queryClient = useQueryClient();
  const { data: documentRoots = ['documents1', 'documents2'] } = useQuery({
    queryKey: ['documentRoots'],
    queryFn: fetchDocumentRoots,
    staleTime: 60_000,
  });
  const state = useExplorerState({ documentRootDirs: documentRoots });
  const {
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
  } = state;

  const search = useExplorerSearch({
    debouncedQuery,
    selectedDirectories,
    searchOptions,
    searchOptionsKey,
    pageSize,
    currentPage,
    setCurrentPage,
  });

  const reindex = useReindexStatus({
    selectedDirectories,
    setAdvancedExpanded,
  });

  const preview = usePreviewPanel();

  const {
    data: recentFiles = [],
    isLoading: recentLoading,
    error: recentError,
    refetch: refetchRecent,
  } = useRecentFiles(selectedDirectories);

  const rename = useExplorerRename({
    queryClient,
    replaceSelectedRootName,
    previewHandleFileClick: preview.handleFileClick,
    searchResults: search.searchResults,
    setSelectedResultIndex,
  });

  const feedback = useExplorerFeedback({
    search: {
      isSearching: search.isSearching,
      debouncedQuery,
      searchResults: search.searchResults,
      searchError: search.searchError,
    },
    reindex: {
      statusContribution: reindex.statusContribution,
      reindexComplete: reindex.reindexComplete,
      localError: reindex.localError,
      startReindexMutation: reindex.startReindexMutation,
      reindexStatus: reindex.reindexStatus,
      reindexStatusError: reindex.reindexStatusError,
    },
    preview: {
      statusContribution: preview.statusContribution,
      openSuccess: preview.openSuccess,
      openFileMutation: preview.openFileMutation,
      previewLoadError: preview.previewError,
    },
  });

  const filters = useMemo(
    (): ExplorerFilters => ({
      searchQuery,
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
      activeFiltersSummary,
      handleResetFilters,
    }),
    [
      searchQuery,
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
      activeFiltersSummary,
      handleResetFilters,
    ]
  );

  const searchGroup = useMemo(
    (): ExplorerSearch => ({
      searchResults: search.searchResults,
      hasNext: search.hasNext,
      isSearching: search.isSearching,
      searchView: search.searchView,
      totalResults: search.totalResults,
      handlePageChange: search.handlePageChange,
      prefetchPreview: search.prefetchPreview,
    }),
    [
      search.searchResults,
      search.hasNext,
      search.isSearching,
      search.searchView,
      search.totalResults,
      search.handlePageChange,
      search.prefetchPreview,
    ]
  );

  const reindexGroup = useMemo(
    (): ExplorerReindex => ({
      startReindexMutation: reindex.startReindexMutation,
      reindexStatus: reindex.reindexStatus,
      handleReindex: reindex.handleReindex,
    }),
    [reindex.startReindexMutation, reindex.reindexStatus, reindex.handleReindex]
  );

  const previewGroup = useMemo(
    (): ExplorerPreview => ({
      previewData: preview.previewData,
      previewError: preview.previewError,
      previewErrorPath: preview.previewErrorPath,
      isClosing: preview.isClosing,
      isPreviewLoading: preview.isPreviewLoading,
      handleFileClick: preview.handleFileClick,
      openPathWithSystem: preview.openPathWithSystem,
      closePreview: preview.closePreview,
    }),
    [
      preview.previewData,
      preview.previewError,
      preview.previewErrorPath,
      preview.isClosing,
      preview.isPreviewLoading,
      preview.handleFileClick,
      preview.openPathWithSystem,
      preview.closePreview,
    ]
  );

  const feedbackGroup = useMemo(
    (): ExplorerFeedback => ({
      status: feedback.status,
      reindexShowSuccess: feedback.reindexShowSuccess,
      errorMessage: feedback.errorMessage,
      showNoResultsError: feedback.showNoResultsError,
    }),
    [
      feedback.status,
      feedback.reindexShowSuccess,
      feedback.errorMessage,
      feedback.showNoResultsError,
    ]
  );

  const shell = useMemo(
    (): ExplorerShell => ({
      resultsViewMode,
      setResultsViewMode,
      selectedResultIndex,
      setSelectedResultIndex,
    }),
    [resultsViewMode, setResultsViewMode, selectedResultIndex, setSelectedResultIndex]
  );

  const recentGroup = useMemo(
    (): ExplorerRecent => ({
      files: recentFiles,
      isLoading: recentLoading,
      error: recentError ?? null,
      refetch: refetchRecent,
    }),
    [recentFiles, recentLoading, recentError, refetchRecent]
  );

  return {
    documentRoots,
    filters,
    search: searchGroup,
    reindex: reindexGroup,
    preview: previewGroup,
    feedback: feedbackGroup,
    shell,
    recent: recentGroup,
    rename,
  };
}
