import { ExternalLink, MoreVertical } from 'lucide-react';
import type { FileItem } from './types';
import { formatFileSize, formatModifiedDate, toApiPath } from './types';

interface ResultsDetailsTableProps {
  files: FileItem[];
  selectedIndex: number | null;
  onSelectIndex: (index: number | null) => void;
  onPreview: (file: FileItem) => void;
  onOpenOs: (file: FileItem) => void;
  onHover: (file: FileItem) => void;
  showRerankScore: boolean;
  onRenameRequest?: (file: FileItem) => void;
  onOpenResultMenu?: (file: FileItem, clientX: number, clientY: number) => void;
  openMenuFileId?: string | null;
}

function folderPath(file: FileItem): string {
  const raw = toApiPath(file.path);
  const i = raw.lastIndexOf('/');
  return i <= 0 ? '' : raw.slice(0, i);
}

function fileTypeLabel(file: FileItem): string {
  if (file.type === 'folder') return 'File folder';
  const dot = file.name.lastIndexOf('.');
  return dot >= 0 ? `${file.name.slice(dot + 1).toUpperCase()} file` : 'File';
}

export function ResultsDetailsTable({
  files,
  selectedIndex,
  onSelectIndex,
  onPreview,
  onOpenOs,
  onHover,
  showRerankScore,
  onRenameRequest,
  onOpenResultMenu,
  openMenuFileId,
}: ResultsDetailsTableProps) {
  return (
    <div className="border border-[var(--color-border)] rounded-md overflow-hidden bg-[var(--color-card)]">
      <table className="w-full text-sm text-left border-collapse">
        <thead>
          <tr className="bg-[var(--color-muted)]/50 text-[var(--color-foreground)]/70 text-xs uppercase tracking-wide">
            <th className="px-3 py-2 font-medium w-[28%]">Name</th>
            <th className="px-3 py-2 font-medium w-[24%] hidden sm:table-cell">Path</th>
            <th className="px-3 py-2 font-medium w-[20%] hidden md:table-cell">Date modified</th>
            <th className="px-3 py-2 font-medium w-[12%] hidden lg:table-cell">Type</th>
            <th className="px-3 py-2 font-medium w-[10%] text-right">Size</th>
            <th className="px-2 py-2 w-[4.5rem] text-right" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {files.map((file, index) => {
            const selected = selectedIndex === index;
            const canRename =
              Boolean(onOpenResultMenu && onRenameRequest) &&
              (file.type === 'file' || file.type === 'folder');
            return (
              <tr
                key={file.id}
                data-result-index={index}
                className={`group border-t border-[var(--color-border)] cursor-pointer transition-colors ${
                  selected
                    ? 'bg-[var(--color-primary)]/15 ring-1 ring-inset ring-[var(--color-primary)]/30'
                    : 'hover:bg-[var(--color-muted)]/40'
                }`}
                onMouseEnter={() => onHover(file)}
                onClick={() => {
                  onSelectIndex(index);
                  onPreview(file);
                }}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  onSelectIndex(index);
                  onOpenOs(file);
                }}
                onContextMenu={(e) => {
                  if (!canRename || !onOpenResultMenu) return;
                  e.preventDefault();
                  onSelectIndex(index);
                  onOpenResultMenu(file, e.clientX, e.clientY);
                }}
              >
                <td className="px-3 py-2 font-medium text-[var(--color-foreground)] truncate max-w-0">
                  {file.name}
                  {showRerankScore && file.rerankScore != null && (
                    <span className="ml-2 text-xs font-normal text-[var(--color-foreground)]/50">
                      {(file.rerankScore * 100).toFixed(0)}%
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-[var(--color-foreground)]/50 font-mono text-xs truncate max-w-0 hidden sm:table-cell">
                  {folderPath(file) || '—'}
                </td>
                <td className="px-3 py-2 text-[var(--color-foreground)]/60 whitespace-nowrap hidden md:table-cell">
                  {formatModifiedDate(file.mtimeMs ?? null)}
                </td>
                <td className="px-3 py-2 text-[var(--color-foreground)]/60 hidden lg:table-cell">
                  {fileTypeLabel(file)}
                </td>
                <td className="px-3 py-2 text-right text-[var(--color-foreground)]/60 tabular-nums">
                  {formatFileSize(file.sizeBytes ?? null)}
                </td>
                <td className="px-1 py-1 text-right">
                  <div className="inline-flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    {file.type === 'file' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenOs(file);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="p-1.5 rounded text-[var(--color-foreground)]/50 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10"
                        title="Open with system application"
                        aria-label="Open with system application"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canRename && onOpenResultMenu && (
                      <button
                        type="button"
                        aria-haspopup="menu"
                        aria-expanded={openMenuFileId === file.id}
                        aria-label={`Actions for ${file.name}`}
                        title="Actions"
                        className="p-1.5 rounded text-[var(--color-foreground)]/50 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                          onOpenResultMenu(file, r.left, r.bottom + 4);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
