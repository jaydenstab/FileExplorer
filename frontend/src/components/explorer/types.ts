import type { SearchResultItem } from '../../lib/api';

export interface FileItem {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  rerankScore?: number;
  distance?: number;
}

export interface SearchView {
  items: FileItem[];
  hasNext: boolean;
  page: number;
  pageSize: number;
  queryConfidenceScore?: number;
  queryConfidenceLevel?: 'low' | 'medium' | 'high';
}

export const SEARCH_DEBOUNCE_MS = 600;
export const DEFAULT_PAGE_SIZE = 10;

export const AVAILABLE_DIRECTORIES = ['documents1', 'documents2'];

export const DISTANCE_MIN = 0;
export const DISTANCE_MAX = 2;

export function resultToFileItem(raw: string | SearchResultItem, index: number): FileItem {
  const path = typeof raw === 'string' ? raw : raw.path;
  const parts = path.split('/');
  const name = parts[parts.length - 1];
  const hasExtension = name.includes('.');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const item: FileItem = {
    id: normalizedPath,
    name,
    path: normalizedPath,
    type: hasExtension ? 'file' : 'folder',
  };
  if (typeof raw === 'object') {
    if (raw.rerank_score != null) item.rerankScore = raw.rerank_score;
    if (raw.distance != null) item.distance = raw.distance;
  }
  return item;
}

export function formatRelevanceScore(score: number): string {
  const pct = score * 100;
  return `${pct % 1 === 0 ? pct : pct.toFixed(1)}%`;
}

/** Builds a stable key for filter options used in search query keys. */
export function buildSearchOptionsKey(params: {
  searchMode: 'semantic' | 'text';
  minConfidence: '' | 'high' | 'medium' | 'low';
  distanceThreshold: string;
  useReranker: boolean;
  selectedFileTypes: string[];
}): string {
  return JSON.stringify({
    sm: params.searchMode,
    mc: params.minConfidence,
    dt: params.distanceThreshold,
    ur: params.useReranker,
    ft: [...params.selectedFileTypes].sort(),
  });
}

/** Normalized search descriptor: React Query key for search/prefetch. */
interface SearchDescriptor {
  queryKey: readonly unknown[];
}

export function buildSearchDescriptor(params: {
  debouncedQuery: string;
  selectedDirectories: string[];
  searchOptionsKey: string;
  currentPage: number;
  pageSize: number;
}): SearchDescriptor {
  const directoriesKey = [...params.selectedDirectories].sort().join(',');
  const queryKey = [
    'search',
    params.debouncedQuery,
    directoriesKey,
    params.searchOptionsKey,
    params.currentPage,
    params.pageSize,
  ] as const;
  return { queryKey };
}

/** Converts display path (may have leading slash) to API path (no leading slash). */
export function toApiPath(path: string): string {
  return path.startsWith('/') ? path.slice(1) : path;
}

/** Formats selected directories for display in UI copy. */
export function formatDirectoriesText(selectedDirectories: string[]): string {
  if (selectedDirectories.length === 0) return 'no directories';
  if (selectedDirectories.length === 1) return selectedDirectories[0];
  return `${selectedDirectories.length} directories`;
}

export function getActiveFiltersSummary(params: {
  searchMode: 'semantic' | 'text';
  minConfidence: '' | 'high' | 'medium' | 'low';
  distanceThreshold: string;
  isDistanceInvalid: boolean;
  useReranker: boolean;
  selectedFileTypes: string[];
}): string | null {
  const {
    searchMode,
    minConfidence,
    distanceThreshold,
    isDistanceInvalid,
    useReranker,
    selectedFileTypes,
  } = params;
  const parts: string[] = [];
  if (searchMode === 'text') parts.push('Literal text search');
  if (minConfidence) parts.push(`Min relevance: ${minConfidence}`);
  if (distanceThreshold && !isDistanceInvalid) parts.push(`Distance ≤ ${distanceThreshold}`);
  if (!useReranker) parts.push('No reranker');
  if (selectedFileTypes.length > 0) parts.push(`Types: ${selectedFileTypes.join(', ')}`);
  return parts.length === 0 ? null : parts.join(' · ');
}
