import { useState, useEffect } from 'react';
import type { FileItem } from './types';

interface RenameFileDialogProps {
  file: FileItem | null;
  onClose: () => void;
  onConfirm: (file: FileItem, newBaseName: string) => Promise<void>;
  pending: boolean;
  errorMessage?: string | null;
}

function basenameHasExtension(filename: string): boolean {
  const i = filename.lastIndexOf('.');
  return i > 0 && i < filename.length - 1;
}

export function RenameFileDialog({ file, onClose, onConfirm, pending, errorMessage }: RenameFileDialogProps) {
  const [name, setName] = useState('');
  const [extensionChangeAck, setExtensionChangeAck] = useState(false);

  useEffect(() => {
    if (file) {
      setName(file.name);
      setExtensionChangeAck(false);
    }
  }, [file]);

  const trimmed = name.trim();
  const originalHadExt = file ? basenameHasExtension(file.name) : false;
  const newHasExt = basenameHasExtension(trimmed);
  const dropsExtension = Boolean(
    file &&
      file.type !== 'folder' &&
      originalHadExt &&
      trimmed.length > 0 &&
      !newHasExt
  );

  useEffect(() => {
    if (!dropsExtension) setExtensionChangeAck(false);
  }, [dropsExtension]);

  if (!file) return null;

  const isFolder = file.type === 'folder';

  const submit = async () => {
    if (!trimmed || trimmed === file.name) {
      onClose();
      return;
    }
    if (dropsExtension && !extensionChangeAck) {
      return;
    }
    try {
      await onConfirm(file, trimmed);
      onClose();
    } catch {
      /* keep dialog open; error surfaced by parent */
    }
  };

  const renameDisabled = pending || !trimmed || (dropsExtension && !extensionChangeAck);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-dialog-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape') e.stopPropagation();
      }}
    >
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-lg max-w-md w-full p-4">
        <h2 id="rename-dialog-title" className="text-lg font-semibold mb-2">
          {isFolder ? 'Rename folder' : 'Rename file'}
        </h2>
        <p className="text-xs text-[var(--color-foreground)]/60 font-mono mb-3 truncate" title={file.path}>
          {file.path}
        </p>
        <label className="block text-sm mb-1" htmlFor="rename-input">
          New name
        </label>
        <input
          id="rename-input"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !renameDisabled) void submit();
            if (e.key === 'Escape') onClose();
          }}
          className="w-full px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)] mb-2"
        />
        {dropsExtension ? (
          <div className="mb-3 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-[var(--color-foreground)]/90">
            <p className="mb-2">
              The new name has no file extension. Preview and search may treat this file differently than before.
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={extensionChangeAck}
                onChange={(e) => setExtensionChangeAck(e.target.checked)}
                className="rounded border-[var(--color-border)]"
              />
              <span>I understand — continue with rename</span>
            </label>
          </div>
        ) : null}
        {errorMessage ? (
          <p className="text-xs text-[var(--color-error)] mb-3" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded border border-[var(--color-border)] hover:bg-[var(--color-muted)]"
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={renameDisabled}
            className="px-3 py-1.5 text-sm rounded bg-[var(--color-primary)] text-white disabled:opacity-50"
          >
            {pending ? 'Renaming…' : 'Rename'}
          </button>
        </div>
      </div>
    </div>
  );
}
