// Backend API base URL - from environment variable
const rawBase = import.meta.env.VITE_API_BASE_URL;
const API_BASE_URL = (rawBase ?? '/api').replace(/\/+$/, '');

// Safe JSON parsing helpers
const parseJsonSafe = async (response: Response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const errorFromResponse = async (response: Response, fallback: string) => {
  const body = await parseJsonSafe(response);
  let nestedCode: string | undefined;
  const nestedMessage =
    typeof body === 'object' && body !== null
      ? (() => {
          const err = (body as { error?: { message?: string; code?: string } }).error;
          if (typeof err === 'object' && err !== null) {
            nestedCode = typeof err.code === 'string' ? err.code : undefined;
            return err.message;
          }
          return undefined;
        })() ??
        (body as { error_message?: string }).error_message
      : undefined;
  const rawMessage =
    typeof body === 'string'
      ? body || `${fallback} (${response.status})`
      : nestedMessage || (body as { error?: string })?.error || `${fallback} (${response.status})`;
  const statusHint: Record<number, string> = {
    400: 'Bad request.',
    401: 'Unauthorized.',
    403: 'Access denied for this file/path.',
    404: 'Requested file/resource was not found.',
    408: 'Request timed out.',
    413: 'File is too large for this operation.',
    429: 'Too many requests. Try again shortly.',
    500: 'Server error occurred.',
    502: 'Gateway error occurred.',
    503: 'Service is temporarily unavailable.',
    504: 'Gateway timed out.',
  };
  const hint = statusHint[response.status];
  const codeSuffix = nestedCode ? ` [${nestedCode}]` : '';
  const message = (hint ? `${rawMessage} ${hint}` : rawMessage) + codeSuffix;
  throw new Error(message);
};

/** Per-result item when include_scores=true; backend returns path + optional distance/rerank_score */
export interface SearchResultItem {
  path: string;
  distance?: number;
  rerank_score?: number;
}

export interface SearchResponse {
  query: string;
  directories: string[];
  /** Matches backend search_mode (semantic vs plain text). */
  search_mode?: 'semantic' | 'text';
  page: number;
  page_size: number;
  has_next: boolean;
  /** Path strings when include_scores=false; SearchResultItem when include_scores=true */
  results: string[] | SearchResultItem[];
  query_confidence_score?: number;
  query_confidence_level?: 'low' | 'medium' | 'high';
}

export interface SearchOptions {
  distanceThreshold?: number;
  minConfidence?: 'high' | 'medium' | 'low';
  useReranker?: boolean;
  fileTypes?: string[];
  /** Backend `search_mode`: semantic (embeddings) vs text (substring). */
  searchMode?: 'semantic' | 'text';
}

/** Text file preview - content is the file text */
export interface TextPreview {
  type: 'text';
  content: string;
  name: string;
  path: string;
  size?: number;
}

/** PDF preview - use pdfUrl for embedding; content is empty from API (client uses pdf.js). */
export interface PdfPreview {
  type: 'pdf';
  name: string;
  path: string;
  content?: string;
  pages?: number;
  preview_pages?: number;
}

export type PreviewData = TextPreview | PdfPreview;

export interface OpenOsSuccess {
  success: boolean;
  message: string;
  path: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isOpenOsSuccess(data: unknown): data is OpenOsSuccess {
  if (!isRecord(data)) return false;
  return (
    data.success === true &&
    typeof data.message === 'string' &&
    typeof data.path === 'string'
  );
}

function isPreviewData(data: unknown): data is PreviewData {
  if (!isRecord(data)) return false;
  if (data.type === 'text') {
    return (
      typeof data.content === 'string' &&
      typeof data.name === 'string' &&
      typeof data.path === 'string'
    );
  }
  if (data.type === 'pdf') {
    return typeof data.name === 'string' && typeof data.path === 'string';
  }
  return false;
}

/** URL for embedding a PDF in iframe/object/embed */
export function getPdfEmbedUrl(path: string): string {
  return `${API_BASE_URL}/file?path=${encodeURIComponent(path)}`;
}

export interface ReindexStartResponse {
  job_id: string;
}

export interface ReindexStatusResponse {
  job_id: string;
  status: 'indexing' | 'completed' | 'error';
  directory: string;
  current: number;
  total: number;
  percent: number;
  current_file?: string;
  phase?: 'reading' | 'embedding' | 'storing' | 'completed';
  updated_at: string;
  error?: string;
}

/**
 * Search for files matching a query.
 * @param query - Search query string
 * @param directories - Array of directory names to search
 * @param page - Page number (1-indexed)
 * @param pageSize - Number of results per page
 * @param options - Optional filters: distanceThreshold, minConfidence, useReranker, fileTypes
 * @param signal - Optional AbortSignal for request cancellation
 */
export const searchFiles = async (
  query: string,
  directories: string[],
  page: number,
  pageSize: number,
  options?: SearchOptions,
  signal?: AbortSignal
): Promise<SearchResponse> => {
  const dirsParam = directories.join(',');
  const params = new URLSearchParams({
    q: query,
    dirs: dirsParam,
    page: page.toString(),
    page_size: pageSize.toString(),
    include_scores: 'true',
  });

  if (options) {
    if (options.searchMode) {
      params.set('search_mode', options.searchMode);
    }
    if (options.distanceThreshold != null && options.distanceThreshold >= 0) {
      params.set('distance_threshold', options.distanceThreshold.toString());
    }
    if (options.minConfidence) {
      params.set('min_confidence', options.minConfidence);
    }
    if (options.useReranker !== undefined) {
      params.set('use_reranker', options.useReranker ? 'true' : 'false');
    }
    if (options.fileTypes && options.fileTypes.length > 0) {
      params.set('file_types', options.fileTypes.join(','));
    }
  }

  const response = await fetch(`${API_BASE_URL}/search?${params.toString()}`, { signal });

  if (!response.ok) {
    await errorFromResponse(response, 'Search failed');
  }

  return response.json();
};

/**
 * Start an indexing job in the background.
 * @param directory - Directory name to index
 * @param slowMs - Optional artificial delay in milliseconds per file (for testing)
 */
export const startReindex = async (
  directory: string,
  slowMs: number = 0
): Promise<ReindexStartResponse> => {
  const params = new URLSearchParams({
    dir: directory,
    ...(slowMs > 0 && { slow_ms: slowMs.toString() }),
  });

  const response = await fetch(`${API_BASE_URL}/reindex/start?${params.toString()}`, {
    method: 'POST',
  });

  if (!response.ok) {
    await errorFromResponse(response, 'Failed to start reindexing');
  }

  return response.json();
};

/**
 * Get the current progress of an indexing job.
 * @param jobId - Job identifier returned from startReindex
 */
export const getReindexStatus = async (jobId: string): Promise<ReindexStatusResponse> => {
  const response = await fetch(
    `${API_BASE_URL}/reindex/status?job_id=${encodeURIComponent(jobId)}`
  );

  if (!response.ok) {
    await errorFromResponse(response, 'Failed to get reindex status');
  }

  return response.json();
};

/**
 * Open a file via OS or return preview content.
 * @param path - Relative file path from project root (e.g., "documents1/file.pdf")
 * @param mode - "preview" to return content, "open_os" to open with OS app
 * @param signal - Optional AbortSignal for request cancellation
 */
export async function openFile(
  path: string,
  mode: 'preview',
  signal?: AbortSignal
): Promise<PreviewData>;
export async function openFile(
  path: string,
  mode: 'open_os',
  signal?: AbortSignal
): Promise<OpenOsSuccess>;
export async function openFile(
  path: string,
  mode: 'preview' | 'open_os',
  signal?: AbortSignal
): Promise<PreviewData | OpenOsSuccess> {
  const response = await fetch(
    `${API_BASE_URL}/open?path=${encodeURIComponent(path)}&mode=${mode}`,
    { signal }
  );

  if (!response.ok) {
    await errorFromResponse(response, 'Failed to open file');
  }

  const data: unknown = await response.json();
  if (mode === 'open_os') {
    if (!isOpenOsSuccess(data)) {
      throw new Error('Unexpected response from server when opening file with the system app.');
    }
    return data;
  }
  if (!isPreviewData(data)) {
    throw new Error('Unexpected response from server when loading preview.');
  }
  return data;
}

export const openPreview = (path: string, signal?: AbortSignal): Promise<PreviewData> =>
  openFile(path, 'preview', signal);

export const openWithSystem = (path: string, signal?: AbortSignal): Promise<OpenOsSuccess> =>
  openFile(path, 'open_os', signal);

