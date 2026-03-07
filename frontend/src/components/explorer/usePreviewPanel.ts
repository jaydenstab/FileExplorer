import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { openFile, type PreviewData } from '../../lib/api';
import type { FileItem } from './types';
import { toApiPath } from './types';
import type { StatusState } from '../StatusBar';

export interface UsePreviewPanelResult {
  previewData: PreviewData | null;
  previewError: string | null;
  previewErrorPath: string | null;
  handleFileClick: (file: FileItem, mode?: 'preview' | 'open_os') => void;
  /** Open a file with the system app by path (API path, no leading slash). Used by PreviewPanel. */
  openPathWithSystem: (path: string) => void;
  closePreview: () => void;
  openFileMutation: ReturnType<typeof useMutation<PreviewData | void, Error, { path: string; mode: 'preview' | 'open_os' }>>;
  /** Status to show in StatusBar when loading preview/open; null when idle */
  statusContribution: StatusState | null;
  /** True when open_os just completed; parent uses for success toast, clears after 2s */
  openSuccess: boolean;
}

export function usePreviewPanel(): UsePreviewPanelResult {
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewErrorPath, setPreviewErrorPath] = useState<string | null>(null);
  const [pendingFileMode, setPendingFileMode] = useState<'preview' | 'open_os' | null>(null);
  const [statusContribution, setStatusContribution] = useState<StatusState | null>(null);
  const [openSuccess, setOpenSuccess] = useState(false);
  const queryClient = useQueryClient();
  const statusTimeoutRef = useRef<number | null>(null);
  const successTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) window.clearTimeout(statusTimeoutRef.current);
      if (successTimeoutRef.current) window.clearTimeout(successTimeoutRef.current);
    };
  }, []);

  const openFileMutation = useMutation({
    mutationFn: ({ path, mode }: { path: string; mode: 'preview' | 'open_os' }) => openFile(path, mode),
    onSuccess: (data, variables) => {
      if (variables.mode === 'preview') {
        setPreviewError(null);
        setPreviewErrorPath(null);
        setPreviewData(data as PreviewData);
        queryClient.setQueryData(['preview', variables.path], data);
        if (statusTimeoutRef.current) window.clearTimeout(statusTimeoutRef.current);
        statusTimeoutRef.current = window.setTimeout(() => {
          setStatusContribution((prev) => (prev?.type === 'preview' ? null : prev));
        }, 300);
      } else {
        if (successTimeoutRef.current) window.clearTimeout(successTimeoutRef.current);
        setOpenSuccess(true);
        successTimeoutRef.current = window.setTimeout(() => setOpenSuccess(false), 2000);
        if (statusTimeoutRef.current) window.clearTimeout(statusTimeoutRef.current);
        statusTimeoutRef.current = window.setTimeout(() => {
          setStatusContribution((prev) => (prev?.type === 'open' ? null : prev));
        }, 500);
      }
    },
    onError: (error: Error, variables) => {
      if (variables.mode === 'preview') {
        setPreviewError(error.message);
        setPreviewErrorPath(variables.path);
        setPreviewData(null);
        if (statusTimeoutRef.current) window.clearTimeout(statusTimeoutRef.current);
        statusTimeoutRef.current = window.setTimeout(() => {
          setStatusContribution((prev) => (prev?.type === 'preview' ? null : prev));
        }, 300);
      }
    },
  });

  useEffect(() => {
    if (openFileMutation.isPending && pendingFileMode) {
      if (pendingFileMode === 'preview') {
        setStatusContribution({ type: 'preview', message: 'Loading preview...' });
      } else {
        setStatusContribution({ type: 'open', message: 'Opening file...' });
      }
    } else if (!openFileMutation.isPending && pendingFileMode) {
      setPendingFileMode(null);
    }
  }, [openFileMutation.isPending, pendingFileMode]);

  const handleFileClick = useCallback(
    (file: FileItem, mode: 'preview' | 'open_os' = 'preview') => {
      if (file.type === 'folder') return;

      const path = toApiPath(file.path);

      if (mode === 'preview') {
        const cacheKey = ['preview', path] as const;
        const cached = queryClient.getQueryData<PreviewData>(cacheKey);
        if (cached) {
          setPreviewData(cached);
          return;
        }
      }

      setPendingFileMode(mode);
      openFileMutation.mutate({ path, mode });
    },
    [openFileMutation, queryClient]
  );

  const openPathWithSystem = useCallback(
    (path: string) => {
      setPendingFileMode('open_os');
      openFileMutation.mutate({ path: toApiPath(path), mode: 'open_os' });
    },
    [openFileMutation]
  );

  const closePreview = useCallback(() => {
    setPreviewData(null);
    setPreviewError(null);
    setPreviewErrorPath(null);
  }, []);

  // ESC key to close preview (colocated with preview ownership)
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (previewData || previewError)) {
        closePreview();
      }
    };
    if (previewData || previewError) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [previewData, previewError, closePreview]);

  return {
    previewData,
    previewError,
    previewErrorPath,
    handleFileClick,
    openPathWithSystem,
    closePreview,
    openFileMutation,
    statusContribution,
    openSuccess,
  };
}
