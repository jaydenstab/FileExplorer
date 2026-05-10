import type { SearchResultItem, RecentFileItem } from '../../lib/api';

export type ResultsViewMode = 'list' | 'details';

export interface FileItem {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  rerankScore?: number;
  distance?: number;
  /** From search `include_metadata` (ms since epoch). */
  mtimeMs?: number | null;
  sizeBytes?: number | null;
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
    if ('mtime_ms' in raw) item.mtimeMs = raw.mtime_ms ?? null;
    if ('size_bytes' in raw) item.sizeBytes = raw.size_bytes ?? null;
  }
  return item;
}

/** Build a FileItem from an API relative path (e.g. recent list). */
export function pathToFileItem(relPath: string): FileItem {
  const path = relPath.startsWith('/') ? relPath : `/${relPath}`;
  const parts = relPath.replace(/^\//, '').split('/');
  const name = parts[parts.length - 1] || relPath;
  const hasExtension = name.includes('.');
  return {
    id: path,
    name,
    path,
    type: hasExtension ? 'file' : 'folder',
  };
}

export function recentItemToFileItem(item: RecentFileItem): FileItem {
  const base = pathToFileItem(item.path);
  const asFolder = item.kind === 'folder';
  return {
    ...base,
    type: asFolder ? 'folder' : base.type,
    mtimeMs: item.mtime_ms,
    sizeBytes: item.size ?? null,
  };
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatModifiedDate(mtimeMs: number | null | undefined): string {
  if (mtimeMs == null) return '—';
  try {
    return new Date(mtimeMs).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return '—';
  }
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

/** Same parent as `file`, new filename (for rename `to` path). */
export function siblingApiPathWithNewName(file: FileItem, newBaseName: string): string {
  const api = toApiPath(file.path);
  const i = api.lastIndexOf('/');
  const parent = i >= 0 ? api.slice(0, i) : '';
  return parent ? `${parent}/${newBaseName}` : newBaseName;
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
