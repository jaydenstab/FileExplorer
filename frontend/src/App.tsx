import { useState, useCallback, useEffect, useRef, useMemo, memo } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { SearchBar } from './components/SearchBar';
import { RotateCw, Folder, FileText, CheckCircle2, ChevronLeft, ChevronRight, X, ExternalLink } from 'lucide-react';
import { Theme } from './components/ui/theme';
import { searchFiles, reindexDirectory, openFile, type SearchResponse, type PreviewData } from './lib/api';

interface FileItem {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
}

interface SearchView {
  items: FileItem[];
  hasNext: boolean;
  page: number;
  pageSize: number;
}

const SEARCH_DEBOUNCE_MS = 600;
const DEFAULT_PAGE_SIZE = 10;

// Available directories (can be made dynamic later via API)
const AVAILABLE_DIRECTORIES = ['documents1', 'documents2'];

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

// Memoized ResultRow component to prevent unnecessary re-renders
interface ResultRowProps {
  file: FileItem;
  onPreviewClick: () => void;
  onOpenClick: () => void;
  onMouseEnter: () => void;
}

const ResultRow = memo(({ file, onPreviewClick, onOpenClick, onMouseEnter }: ResultRowProps) => {
  return (
    <div
      onMouseEnter={onMouseEnter}
      onClick={onPreviewClick}
      className="group bg-[var(--color-card)] hover:bg-[var(--color-muted)] border border-[var(--color-border)] hover:border-[var(--color-primary)] rounded-lg p-4 transition-all duration-200 cursor-pointer"
    >
      <div className="flex items-start gap-3">
        {file.type === 'folder' ? (
          <Folder className="w-5 h-5 text-[var(--color-primary)] flex-shrink-0 mt-0.5" />
        ) : (
          <FileText className="w-5 h-5 text-[var(--color-foreground)]/70 flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-[var(--color-foreground)] group-hover:text-[var(--color-primary)] transition-colors mb-1 font-medium">
                {file.name}
              </h3>
              <p className="text-[var(--color-foreground)]/40 text-sm truncate font-mono">
                {file.path}
              </p>
            </div>
            {file.type === 'file' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenClick();
                }}
                className="open-os-button opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-2 py-1 text-xs text-[var(--color-foreground)]/60 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded"
                title="Open with system application"
              >
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

ResultRow.displayName = 'ResultRow';

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedDirectories, setSelectedDirectories] = useState<string[]>([AVAILABLE_DIRECTORIES[0]]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const queryClient = useQueryClient();
  const debounceTimeoutRef = useRef<number | null>(null);
  const successTimeoutRef = useRef<number | null>(null);

  // Stable query key for directories (sorted to ensure consistent key)
  const directoriesKey = useMemo(() => {
    return [...selectedDirectories].sort().join(',');
  }, [selectedDirectories]);

  // Debounce search query
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      window.clearTimeout(debounceTimeoutRef.current);
    }

    if (!searchQuery.trim()) {
      setDebouncedQuery('');
      setCurrentPage(1);
      return;
    }

    debounceTimeoutRef.current = window.setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setCurrentPage(1); // Reset to page 1 on new search
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceTimeoutRef.current) {
        window.clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Cleanup success timeout on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        window.clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  // Search query with cancellable requests and keepPreviousData
  const {
    data: searchView,
    isFetching: isSearching,
    error: searchError,
  } = useQuery<SearchResponse, Error, SearchView>({
    queryKey: ['search', debouncedQuery, directoriesKey, currentPage, pageSize],
    queryFn: ({ signal }) => searchFiles(debouncedQuery, selectedDirectories, currentPage, pageSize, signal),
    enabled: !!debouncedQuery.trim(),
    placeholderData: keepPreviousData,
    staleTime: 300_000, // 5 minutes
    gcTime: 120_000, // 2 minutes: collect inactive search results sooner
    select: (data) => ({
      items: data.results.map((path: string, index: number) => pathToFileItem(path, index)),
      hasNext: data.has_next,
      page: data.page,
      pageSize: data.page_size,
    }),
  });

  // Reindex mutation
  const reindexMutation = useMutation({
    mutationFn: (directory: string) => reindexDirectory(directory),
    onSuccess: () => {
      if (successTimeoutRef.current) {
        window.clearTimeout(successTimeoutRef.current);
      }
      setShowSuccess(true);
      successTimeoutRef.current = window.setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
      // Invalidate search queries to refetch after reindexing
      queryClient.invalidateQueries({ queryKey: ['search'] });
    },
  });

  // Prefetch preview on hover
  const prefetchPreview = useCallback((path: string) => {
    queryClient.prefetchQuery({
      queryKey: ['preview', path],
      queryFn: ({ signal }) => openFile(path, 'preview', signal) as Promise<PreviewData>,
      staleTime: 30_000, // 30 seconds
    });
  }, [queryClient]);

  // Open file mutation
  const openFileMutation = useMutation({
    mutationFn: ({ path, mode }: { path: string; mode: 'preview' | 'open_os' }) => openFile(path, mode),
    onSuccess: (data, variables) => {
      if (variables.mode === 'preview') {
        setPreviewData(data as PreviewData);
        // Cache the preview data
        queryClient.setQueryData(['preview', variables.path], data);
      } else {
        if (successTimeoutRef.current) {
          window.clearTimeout(successTimeoutRef.current);
        }
        setShowSuccess(true);
        successTimeoutRef.current = window.setTimeout(() => {
          setShowSuccess(false);
        }, 2000);
      }
    },
  });

  // Use searchView data (already mapped via select)
  const searchResults: FileItem[] = searchView?.items || [];
  const hasNext = searchView?.hasNext || false;
  
  // Prefetch next page when available
  useEffect(() => {
    if (!debouncedQuery.trim() || !hasNext) return;
    queryClient.prefetchQuery({
      queryKey: ['search', debouncedQuery, directoriesKey, currentPage + 1, pageSize],
      queryFn: ({ signal }) =>
        searchFiles(debouncedQuery, selectedDirectories, currentPage + 1, pageSize, signal),
      staleTime: 300_000,
      gcTime: 120_000,
    });
  }, [debouncedQuery, directoriesKey, currentPage, pageSize, hasNext, selectedDirectories, queryClient]);
  
  // More accurate total results calculation
  const totalResults = useMemo(() => {
    if (!searchView) return 0;
    // If we have results and there's a next page, estimate total
    // Otherwise, just show current page results count
    if (hasNext) {
      // Estimate: at least (currentPage * pageSize) + 1
      return currentPage * pageSize + (searchResults.length > 0 ? 1 : 0);
    }
    return (currentPage - 1) * pageSize + searchResults.length;
  }, [searchView, hasNext, currentPage, pageSize, searchResults.length]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleReindex = useCallback(() => {
    const dirToIndex = selectedDirectories[0] || AVAILABLE_DIRECTORIES[0];
    reindexMutation.mutate(dirToIndex);
  }, [selectedDirectories, reindexMutation]);


  const handleDirectoryToggle = useCallback((directory: string) => {
    setSelectedDirectories(prev => {
      const isSelected = prev.includes(directory);
      let newSelection: string[];
      
      if (isSelected) {
        // Remove directory, but ensure at least one remains
        newSelection = prev.filter(d => d !== directory);
        if (newSelection.length === 0) {
          newSelection = [AVAILABLE_DIRECTORIES.find(d => d !== directory) || AVAILABLE_DIRECTORIES[0]];
        }
      } else {
        // Add directory
        newSelection = [...prev, directory];
      }
      
      // Reset to page 1 when directories change
      setCurrentPage(1);
      return newSelection;
    });
  }, []);

  const handleFileClick = useCallback((file: FileItem, mode: 'preview' | 'open_os' = 'preview') => {
    if (file.type === 'folder') {
      return; // Folders can't be opened
    }
    
    const path = file.path.slice(1); // Remove leading slash
    
    // For preview mode, check cache first
    if (mode === 'preview') {
      const cacheKey = ['preview', path] as const;
      const cached = queryClient.getQueryData<PreviewData>(cacheKey);
      if (cached) {
        setPreviewData(cached);
        return;
      }
    }
    
    openFileMutation.mutate({ path, mode });
  }, [openFileMutation, queryClient]);

  const closePreview = useCallback(() => {
    setPreviewData(null);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    if (newPage >= 1 && (!hasNext || newPage <= currentPage + 1)) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage, hasNext]);

  const getDirectoriesText = useCallback(() => {
    if (selectedDirectories.length === 1) {
      return selectedDirectories[0];
    }
    return `${selectedDirectories.length} directories`;
  }, [selectedDirectories]);

  // Determine error message
  const errorMessage = searchError instanceof Error 
    ? searchError.message 
    : openFileMutation.error instanceof Error
    ? openFileMutation.error.message
    : reindexMutation.error instanceof Error
    ? reindexMutation.error.message
    : null;

  // Show "no results" error if search completed but no results
  const showNoResultsError = !isSearching && debouncedQuery.trim() && searchResults.length === 0 && !searchError;

  return (
    <div className="h-screen bg-[var(--color-background)] flex overflow-hidden">
      {/* Left Sidebar - Directory List */}
      <div className="w-64 border-r border-[var(--color-border)] bg-[var(--color-card)] flex flex-col flex-shrink-0">
        <div className="p-4">
          <h2 className="text-xs font-semibold text-[var(--color-foreground)]/60 mb-3 uppercase tracking-wider">
            Directories
          </h2>
          <div className="space-y-1">
            {AVAILABLE_DIRECTORIES.map((directory) => {
              const isSelected = selectedDirectories.includes(directory);
              return (
                <button
                  key={directory}
                  onClick={() => handleDirectoryToggle(directory)}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200
                    ${
                      isSelected
                        ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/50'
                        : 'text-[var(--color-foreground)]/70 hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] border border-transparent'
                    }
                  `}
                >
                  <div className={`w-4 h-4 border-2 rounded flex items-center justify-center flex-shrink-0 ${
                    isSelected 
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]' 
                      : 'border-[var(--color-foreground)]/30'
                  }`}>
                    {isSelected && (
                      <div className="w-2 h-2 bg-white rounded-sm" />
                    )}
                  </div>
                  <Folder className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{directory}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with Theme Toggle */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
          <h1 className="text-[var(--color-foreground)] text-3xl font-bold tracking-tight">
            File Explorer
          </h1>
          <Theme variant="button" size="md" />
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="max-w-4xl mx-auto">
            {/* Search Bar */}
            <div className="mb-8">
              <SearchBar
                value={searchQuery}
                onChange={handleSearch}
                placeholder="Search files and folders..."
              />
            </div>

            {/* Loading Indicator - only show when no previous data */}
            {isSearching && searchResults.length === 0 && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--color-border)] border-t-[var(--color-primary)]" />
              </div>
            )}
            
            {/* Subtle loading indicator when fetching with existing data */}
            {isSearching && searchResults.length > 0 && (
              <div className="flex items-center justify-center py-2 mb-4">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--color-border)] border-t-[var(--color-primary)]" />
              </div>
            )}

            {/* Reindex Button */}
            <div className="flex items-center justify-center gap-4 mb-8">
              <button
                onClick={handleReindex}
                disabled={reindexMutation.isPending}
                className="flex items-center gap-2 px-6 py-3 bg-[var(--color-card)] hover:bg-[var(--color-primary)]/20 disabled:bg-[var(--color-muted)] disabled:cursor-not-allowed text-[var(--color-foreground)] rounded-lg transition-all duration-200 border border-[var(--color-border)] hover:border-[var(--color-primary)]"
              >
                <RotateCw
                  className={`w-4 h-4 ${reindexMutation.isPending ? 'animate-spin' : ''}`}
                />
                {reindexMutation.isPending ? 'Reindexing...' : 'Reindex Files'}
              </button>

              {showSuccess && (
                <div className="flex items-center gap-2 text-[var(--color-success)] animate-in fade-in slide-in-from-left-2 duration-300">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Operation completed successfully!</span>
                </div>
              )}
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-8 p-4 bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-lg">
                <p className="text-[var(--color-error)] text-center">{errorMessage}</p>
              </div>
            )}

            {/* No Results Message */}
            {showNoResultsError && (
              <div className="mb-8 p-4 bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-lg">
                <p className="text-[var(--color-error)] text-center">
                  No files found matching your search in {getDirectoriesText()}. If this is the first time searching these directories, try clicking "Reindex Files" to index them first.
                </p>
              </div>
            )}

            {/* Results Section */}
            {searchResults.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[var(--color-foreground)]/60">
                    Found {totalResults > 0 ? totalResults : searchResults.length} result{(totalResults > 0 ? totalResults : searchResults.length) !== 1 ? 's' : ''} in {getDirectoriesText()}
                  </p>
                </div>
                
                <div className="space-y-2">
                  {searchResults.map((file) => (
                    <ResultRow
                      key={file.id}
                      file={file}
                      onPreviewClick={() => handleFileClick(file, 'preview')}
                      onOpenClick={() => handleFileClick(file, 'open_os')}
                      onMouseEnter={() => {
                        if (file.type === 'file') {
                          prefetchPreview(file.path.slice(1));
                        }
                      }}
                    />
                  ))}
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border)]">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || isSearching}
                    className="flex items-center gap-1 px-4 py-2 text-sm text-[var(--color-foreground)] disabled:text-[var(--color-foreground)]/30 disabled:cursor-not-allowed hover:bg-[var(--color-muted)] rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  
                  <span className="text-sm text-[var(--color-foreground)]/60">
                    Page {currentPage}
                  </span>
                  
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={!hasNext || isSearching}
                    className="flex items-center gap-1 px-4 py-2 text-sm text-[var(--color-foreground)] disabled:text-[var(--color-foreground)]/30 disabled:cursor-not-allowed hover:bg-[var(--color-muted)] rounded-lg transition-colors"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!searchQuery && !isSearching && searchResults.length === 0 && (
              <div className="text-center py-16">
                <FileText className="w-16 h-16 text-[var(--color-foreground)]/20 mx-auto mb-4" />
                <p className="text-[var(--color-foreground)]/40">
                  Start typing to search through files and folders in {getDirectoriesText()}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closePreview}>
          <div 
            className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Preview Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-[var(--color-foreground)] truncate">
                  {previewData.name}
                </h2>
                <p className="text-sm text-[var(--color-foreground)]/60 truncate font-mono">
                  {previewData.path}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleFileClick({ type: 'file', path: previewData.path, name: previewData.name, id: previewData.path } as FileItem, 'open_os')}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-muted)] rounded transition-colors"
                  title="Open with system application"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open
                </button>
                <button
                  onClick={closePreview}
                  className="p-2 text-[var(--color-foreground)]/60 hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)] rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {previewData.type === 'text' ? (
                <pre className="text-sm text-[var(--color-foreground)] whitespace-pre-wrap font-mono">
                  {previewData.content}
                </pre>
              ) : (
                <div className="text-sm text-[var(--color-foreground)]">
                  <p className="mb-4 text-[var(--color-foreground)]/60">
                    PDF Preview: Showing first {previewData.preview_pages || 10} of {previewData.pages || 0} pages
                  </p>
                  <pre className="whitespace-pre-wrap font-mono text-sm">
                    {previewData.content}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
