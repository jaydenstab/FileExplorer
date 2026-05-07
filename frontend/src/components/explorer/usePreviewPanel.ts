import { useState, useCallback, useEffect, useReducer, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { openPreview, openWithSystem, type OpenOsSuccess, type PreviewData } from '../../lib/api';
import type { FileItem } from './types';
import { toApiPath } from './types';
import type { StatusState } from '../StatusBar';

const PREVIEW_LOADING_TIMEOUT_MS = 12000;
const CLOSE_ANIMATION_MS = 300;

interface PreviewUiState {
  isClosing: boolean;
  statusContribution: StatusState | null;
  openSuccess: boolean;
  previewTimeoutError: string | null;
}

type PreviewUiAction =
  | { type: 'set_status'; value: StatusState | null }
  | { type: 'set_open_success'; value: boolean }
  | { type: 'set_timeout_error'; value: string | null }
  | { type: 'set_closing'; value: boolean };

function previewUiReducer(state: PreviewUiState, action: PreviewUiAction): PreviewUiState {
  switch (action.type) {
    case 'set_status':
      return { ...state, statusContribution: action.value };
    case 'set_open_success':
      return { ...state, openSuccess: action.value };
    case 'set_timeout_error':
      return { ...state, previewTimeoutError: action.value };
    case 'set_closing':
      return { ...state, isClosing: action.value };
    default:
      return state;
  }
}

interface UsePreviewPanelResult {
  previewData: PreviewData | null;
  previewError: string | null;
  previewErrorPath: string | null;
  /** True during close animation; keeps pane visible while width animates to 0 */
  isClosing: boolean;
  /** True when loading a preview; keeps pane open with loading state for smoother open UX */
  isPreviewLoading: boolean;
  handleFileClick: (file: FileItem, mode?: 'preview' | 'open_os') => void;
  /** Open a file with the system app by path (API path, no leading slash). Used by PreviewPanel. */
  openPathWithSystem: (path: string) => void;
  closePreview: () => void;
  /** Open-OS mutation for error display in feedback; not used for preview loading */
  openFileMutation: ReturnType<typeof useMutation<OpenOsSuccess, Error, string>>;
  /** Status to show in StatusBar when loading preview/open; null when idle */
  statusContribution: StatusState | null;
  /** True when open_os just completed; parent uses for success toast, clears after 2s */
  openSuccess: boolean;
}

export function usePreviewPanel(): UsePreviewPanelResult {
  const [activePreviewPath, setActivePreviewPath] = useState<string | null>(null);
  const [ui, dispatch] = useReducer(previewUiReducer, {
    isClosing: false,
    statusContribution: null,
    openSuccess: false,
    previewTimeoutError: null,
  });
  const statusTimeoutRef = useRef<number | null>(null);
  const successTimeoutRef = useRef<number | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const previewTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) window.clearTimeout(statusTimeoutRef.current);
      if (successTimeoutRef.current) window.clearTimeout(successTimeoutRef.current);
      if (closeTimeoutRef.current) window.clearTimeout(closeTimeoutRef.current);
      if (previewTimeoutRef.current) window.clearTimeout(previewTimeoutRef.current);
    };
  }, []);

  const previewQuery = useQuery({
    queryKey: ['preview', activePreviewPath] as const,
    queryFn: ({ signal }) => openPreview(activePreviewPath!, signal),
    enabled: !!activePreviewPath,
    staleTime: 30_000,
    gcTime: 120_000,
  });

  const openOsMutation = useMutation({
    mutationFn: (path: string) => openWithSystem(path),
    onSuccess: () => {
      if (successTimeoutRef.current) window.clearTimeout(successTimeoutRef.current);
      dispatch({ type: 'set_open_success', value: true });
      successTimeoutRef.current = window.setTimeout(
        () => dispatch({ type: 'set_open_success', value: false }),
        2000
      );
      if (statusTimeoutRef.current) window.clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = window.setTimeout(() => {
        dispatch({ type: 'set_status', value: null });
      }, 500);
    },
  });

  useEffect(() => {
    if (previewQuery.isFetching && activePreviewPath) {
      if (previewTimeoutRef.current) window.clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = window.setTimeout(() => {
        dispatch({
          type: 'set_timeout_error',
          value: 'Preview is taking longer than expected. Try reopening the file.',
        });
      }, PREVIEW_LOADING_TIMEOUT_MS);
      dispatch({ type: 'set_status', value: { type: 'preview', message: 'Loading preview...' } });
    } else if (!previewQuery.isFetching && ui.statusContribution?.type === 'preview') {
      if (previewTimeoutRef.current) {
        window.clearTimeout(previewTimeoutRef.current);
        previewTimeoutRef.current = null;
      }
      if (statusTimeoutRef.current) window.clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = window.setTimeout(() => {
        dispatch({ type: 'set_status', value: null });
      }, 300);
    }
  }, [previewQuery.isFetching, activePreviewPath, ui.statusContribution?.type]);

  useEffect(() => {
    if (openOsMutation.isPending) {
      dispatch({ type: 'set_status', value: { type: 'open', message: 'Opening file...' } });
    }
  }, [openOsMutation.isPending]);

  const handleFileClick = useCallback(
    (file: FileItem, mode: 'preview' | 'open_os' = 'preview') => {
      if (file.type === 'folder') return;

      const path = toApiPath(file.path);

      if (mode === 'preview') {
        dispatch({ type: 'set_timeout_error', value: null });
        setActivePreviewPath(path);
        return;
      }

      openOsMutation.mutate(path);
    },
    [openOsMutation]
  );

  const openPathWithSystem = useCallback(
    (path: string) => {
      openOsMutation.mutate(toApiPath(path));
    },
    [openOsMutation]
  );

  const closePreview = useCallback(() => {
    const hasContent = !!(previewQuery.data || previewQuery.error);
    const isLoading = previewQuery.isFetching;
    if (!activePreviewPath && !hasContent && !isLoading) return;
    if (closeTimeoutRef.current) window.clearTimeout(closeTimeoutRef.current);
    if (previewTimeoutRef.current) {
      window.clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
    dispatch({ type: 'set_timeout_error', value: null });
    dispatch({ type: 'set_closing', value: true });
    closeTimeoutRef.current = window.setTimeout(() => {
      setActivePreviewPath(null);
      dispatch({ type: 'set_closing', value: false });
      closeTimeoutRef.current = null;
    }, CLOSE_ANIMATION_MS);
  }, [
    previewQuery.data,
    previewQuery.error,
    previewQuery.isFetching,
    activePreviewPath,
  ]);

  const isPreviewLoading = previewQuery.isFetching;
  const previewData = previewQuery.data ?? null;
  const previewError =
    ui.previewTimeoutError ??
    (previewQuery.error instanceof Error ? previewQuery.error.message : null);
  const previewErrorPath = activePreviewPath;

  // ESC key to close preview (colocated with preview ownership)
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (previewData || previewError || isPreviewLoading || activePreviewPath)) {
        closePreview();
      }
    };
    if (previewData || previewError || isPreviewLoading || activePreviewPath) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [previewData, previewError, isPreviewLoading, activePreviewPath, closePreview]);

  return {
    previewData,
    previewError,
    previewErrorPath,
    isClosing: ui.isClosing,
    isPreviewLoading,
    handleFileClick,
    openPathWithSystem,
    closePreview,
    openFileMutation: openOsMutation,
    statusContribution: ui.statusContribution,
    openSuccess: ui.openSuccess,
  };
}
