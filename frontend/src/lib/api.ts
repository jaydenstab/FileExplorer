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
  const message =
    typeof body === 'string'
      ? body || `${fallback} (${response.status})`
      : body?.error || `${fallback} (${response.status})`;
  throw new Error(message);
};

export interface SearchResponse {
  query: string;
  directories: string[];
  page: number;
  page_size: number;
  has_next: boolean;
  results: string[];
}

export interface PreviewData {
  type: 'text' | 'pdf';
  content: string;
  name: string;
  path: string;
  size?: number;
  pages?: number;
  preview_pages?: number;
}

export interface ReindexResponse {
  indexed_chunks: number;
  directory: string;
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
 * @param signal - Optional AbortSignal for request cancellation
 */
export const searchFiles = async (
  query: string,
  directories: string[],
  page: number,
  pageSize: number,
  signal?: AbortSignal
): Promise<SearchResponse> => {
  const dirsParam = directories.join(',');
  const params = new URLSearchParams({
    q: query,
    dirs: dirsParam,
    page: page.toString(),
    page_size: pageSize.toString(),
  });

  const response = await fetch(`${API_BASE_URL}/search?${params.toString()}`, { signal });

  if (!response.ok) {
    await errorFromResponse(response, 'Search failed');
  }

  return response.json();
};

/**
 * Reindex a directory.
 * @param directory - Directory name to reindex
 */
export const reindexDirectory = async (directory: string): Promise<ReindexResponse> => {
  const response = await fetch(`${API_BASE_URL}/reindex?dir=${encodeURIComponent(directory)}`);

  if (!response.ok) {
    await errorFromResponse(response, 'Reindexing failed');
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
export const openFile = async (
  path: string,
  mode: 'preview' | 'open_os',
  signal?: AbortSignal
): Promise<PreviewData | { success: boolean; message: string; path: string }> => {
  const response = await fetch(
    `${API_BASE_URL}/open?path=${encodeURIComponent(path)}&mode=${mode}`,
    { signal }
  );

  if (!response.ok) {
    await errorFromResponse(response, 'Failed to open file');
  }

  return response.json();
};

