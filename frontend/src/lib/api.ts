// Backend API base URL - from environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

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
    const errorData = await response.json();
    throw new Error(errorData.error || 'Search failed');
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
    const errorData = await response.json();
    throw new Error(errorData.error || 'Reindexing failed');
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
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to open file');
  }

  return response.json();
};

