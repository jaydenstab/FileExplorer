import { useState, useCallback, useEffect, useRef } from 'react';
import { SearchBar } from './components/SearchBar';
import { RotateCw, Folder, FileText, CheckCircle2 } from 'lucide-react';

interface FileItem {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
}

// Backend API base URL
const API_BASE_URL = 'http://127.0.0.1:8000/api';
const SEARCH_DEBOUNCE_MS = 600;

type ReindexStatus =
  | { type: 'idle' }
  | { type: 'loading'; since: Date }
  | { type: 'error'; message: string }
  | { type: 'success'; files: number };

type SearchStatus =
  | { type: 'idle' }
  | { type: 'loading'; since: Date }
  | { type: 'error'; message: string }
  | { type: 'success'; results: FileItem[] };

// Convert backend file path to FileItem
const pathToFileItem = (path: string, index: number): FileItem => {
  const parts = path.split('/');
  const name = parts[parts.length - 1];
  // Determine if it's a folder (no extension) or file
  const hasExtension = name.includes('.');
  return {
    id: `file-${index}-${path}`,
    name,
    path: path.startsWith('/') ? path : `/${path}`,
    type: hasExtension ? 'file' : 'folder',
  };
};

export default function App() {
  const [query, setQuery] = useState('');

  // enforce invariants (e.g. "no error and success at the same time" / "no loading and success at the same time")
  const [searchStatus, setSearchStatus] = useState<SearchStatus>({
    type: 'idle',
  });
  const [reindexStatus, setReindexStatus] = useState<SearchStatus>({
    type: 'idle',
  });

  const searchTimeoutRef = useRef<number | null>(null);

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchStatus({ type: 'success', results: [] });
      return;
    }

    setSearchStatus({ type: 'loading', since: new Date() });

    try {
      const response = await fetch(
        `${API_BASE_URL}/search?q=${encodeURIComponent(query)}&k=10`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Search failed');
      }

      const data = await response.json();

      // Transform backend response (array of paths) to FileItem format
      const results: FileItem[] = (data.results || []).map(
        (path: string, index: number) => pathToFileItem(path, index)
      );

      if (results.length === 0) {
        setError('No files found matching your search.');
      }

      setSearchResults(results);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to search files. Make sure the backend server is running.';
      setError(errorMessage);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search effect
  useEffect(() => {
    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
    }

    // If query is empty, clear results immediately
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // Set loading state immediately
    setIsSearching(true);

    // Set timeout for debounced search
    searchTimeoutRef.current = window.setTimeout(() => {
      performSearch(searchQuery);
    }, SEARCH_DEBOUNCE_MS);

    // Cleanup function
    return () => {
      if (searchTimeoutRef.current) {
        window.clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, performSearch]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleReindex = useCallback(async () => {
    setIsReindexing(true);
    setError(null);
    setShowReindexSuccess(false);

    try {
      const response = await fetch(`${API_BASE_URL}/reindex`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Reindexing failed');
      }

      await response.json(); // Response contains indexed_chunks count
      setIsReindexing(false);
      setShowReindexSuccess(true);

      // Hide success message after 3 seconds
      setTimeout(() => {
        setShowReindexSuccess(false);
      }, 3000);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to reindex files. Make sure the backend server is running.';
      setError(errorMessage);
      setIsReindexing(false);
    }
  }, []);

  const getSuggestions = useCallback((_query: string): string[] => {
    // For now, return empty suggestions since we'd need to fetch from backend
    // You could implement a debounced suggestion endpoint if needed
    return [];
  }, []);

  return (
    <div className="min-h-screen bg-black flex items-start justify-center px-6 py-16">
      <div className="w-full max-w-4xl">
        {/* Title */}
        <h1 className="text-white text-center mb-12 text-5xl md:text-6xl font-bold tracking-tight">
          File Explorer
        </h1>

        {/* Search Bar */}
        <div className="mb-8">
          <SearchBar
            value={searchQuery}
            onChange={handleSearch}
            suggestions={getSuggestions(searchQuery)}
            placeholder="Search files and folders..."
          />
        </div>

        {/* Loading Indicator */}
        {isSearching && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent" />
          </div>
        )}

        {/* Reindex Button */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <button
            onClick={handleReindex}
            disabled={isReindexing}
            className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 border border-white/20"
          >
            <RotateCw
              className={`w-4 h-4 ${isReindexing ? 'animate-spin' : ''}`}
            />
            {isReindexing ? 'Reindexing...' : 'Reindex Files'}
          </button>

          {showReindexSuccess && (
            <div className="flex items-center gap-2 text-green-400 animate-in fade-in slide-in-from-left-2 duration-300">
              <CheckCircle2 className="w-5 h-5" />
              <span>Files reindexed successfully!</span>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-center">{error}</p>
          </div>
        )}

        {/* Results Section */}
        {searchResults.length > 0 && !isSearching && (
          <div className="space-y-3">
            <p className="text-white/60 mb-4">
              Found {searchResults.length} result
              {searchResults.length !== 1 ? 's' : ''}
            </p>
            {searchResults.map((file) => (
              <div
                key={file.id}
                className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg p-4 transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  {file.type === 'folder' ? (
                    <Folder className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <FileText className="w-5 h-5 text-white/70 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white group-hover:text-white/90 transition-colors mb-1">
                      {file.name}
                    </h3>
                    <p className="text-white/40 text-sm truncate">
                      {file.path}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!searchQuery && !isSearching && searchResults.length === 0 && (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <p className="text-white/40">
              Start typing to search through files and folders
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
