import { useCallback, useMemo, useState } from 'react';
import { useMutation, type QueryClient } from '@tanstack/react-query';
import { renameFileOnDisk } from '../../lib/api';
import type { FileItem } from './types';
import { pathToFileItem, siblingApiPathWithNewName, toApiPath } from './types';

export interface ExplorerRename {
  dialogFile: FileItem | null;
  openDialog: (file: FileItem) => void;
  /** Open rename for a top-level document root (sidebar). */
  openRenameDialogForRoot: (directoryName: string) => void;
  closeDialog: () => void;
  pending: boolean;
  errorMessage: string | null;
  /** Shown after a successful rename when the search index could not be updated. */
  indexWarning: string | null;
  clearIndexWarning: () => void;
  confirm: (file: FileItem, newBaseName: string) => Promise<void>;
}

interface UseExplorerRenameParams {
  queryClient: QueryClient;
  replaceSelectedRootName: (fromName: string, toName: string) => void;
  previewHandleFileClick: (file: FileItem, mode?: 'preview' | 'open_os') => void;
  searchResults: FileItem[];
  setSelectedResultIndex: (v: number | null | ((p: number | null) => number | null)) => void;
}

export function useExplorerRename({
  queryClient,
  replaceSelectedRootName,
  previewHandleFileClick,
  searchResults,
  setSelectedResultIndex,
}: UseExplorerRenameParams): ExplorerRename {
  const [renameDialogFile, setRenameDialogFile] = useState<FileItem | null>(null);
  const [renameIndexWarning, setRenameIndexWarning] = useState<string | null>(null);

  const clearIndexWarning = useCallback(() => {
    setRenameIndexWarning(null);
  }, []);

  const {
    mutateAsync: renameMutateAsync,
    reset: resetRenameMutation,
    isPending: renameIsPending,
    error: renameMutationError,
  } = useMutation({
    mutationFn: async ({ file, newBaseName }: { file: FileItem; newBaseName: string }) => {
      const fromRel = toApiPath(file.path);
      const toRel = siblingApiPathWithNewName(file, newBaseName);
      return renameFileOnDisk(fromRel, toRel);
    },
    onSuccess: (data, variables) => {
      const fromRel = toApiPath(variables.file.path);
      queryClient.removeQueries({ queryKey: ['preview', fromRel] });
      queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'search',
      });
      queryClient.invalidateQueries({ queryKey: ['recent'] });
      void queryClient.invalidateQueries({ queryKey: ['documentRoots'] });
      if (typeof data?.index_warning === 'string' && data.index_warning.trim()) {
        setRenameIndexWarning(data.index_warning);
      } else {
        setRenameIndexWarning(null);
      }
      void queryClient.refetchQueries({ queryKey: ['documentRoots'] }).then(() => {
        if (
          variables.file.type === 'folder' &&
          !fromRel.includes('/') &&
          data?.path &&
          !toApiPath(data.path).includes('/')
        ) {
          replaceSelectedRootName(fromRel, toApiPath(data.path));
        }
      });
      if (data?.path && variables.file.type === 'file') {
        previewHandleFileClick(pathToFileItem(data.path), 'preview');
      }
    },
  });

  const openDialog = useCallback(
    (file: FileItem) => {
      if (file.type !== 'file' && file.type !== 'folder') return;
      resetRenameMutation();
      setRenameDialogFile(file);
      const idx = searchResults.findIndex((x) => x.id === file.id);
      if (idx >= 0) setSelectedResultIndex(idx);
    },
    [searchResults, setSelectedResultIndex, resetRenameMutation]
  );

  const openRenameDialogForRoot = useCallback(
    (directoryName: string) => {
      const name = directoryName.replace(/^\//, '').split('/')[0] || directoryName;
      if (!name) return;
      const path = name.startsWith('/') ? name : `/${name}`;
      openDialog({ id: path, name, path, type: 'folder' });
    },
    [openDialog]
  );

  const closeDialog = useCallback(() => {
    setRenameDialogFile(null);
    resetRenameMutation();
  }, [resetRenameMutation]);

  const confirm = useCallback(
    async (file: FileItem, newBaseName: string) => {
      await renameMutateAsync({ file, newBaseName });
    },
    [renameMutateAsync]
  );

  const errorMessage =
    renameMutationError instanceof Error
      ? renameMutationError.message
      : renameMutationError
        ? String(renameMutationError)
        : null;

  return useMemo(
    (): ExplorerRename => ({
      dialogFile: renameDialogFile,
      openDialog,
      openRenameDialogForRoot,
      closeDialog,
      pending: renameIsPending,
      errorMessage,
      indexWarning: renameIndexWarning,
      clearIndexWarning,
      confirm,
    }),
    [
      renameDialogFile,
      openDialog,
      openRenameDialogForRoot,
      closeDialog,
      renameIsPending,
      errorMessage,
      renameIndexWarning,
      clearIndexWarning,
      confirm,
    ]
  );
}
