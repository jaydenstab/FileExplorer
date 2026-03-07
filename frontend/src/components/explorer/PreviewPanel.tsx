import { X, ExternalLink, AlertCircle } from 'lucide-react';
import type { PreviewData } from '../../lib/api';

export interface PreviewPanelProps {
  previewData: PreviewData | null;
  previewError: string | null;
  previewErrorPath: string | null;
  onClose: () => void;
  /** Open file with system app by path (API path, no leading slash). */
  onOpenPath: (path: string) => void;
}

export function PreviewPanel({
  previewData,
  previewError,
  previewErrorPath,
  onClose,
  onOpenPath,
}: PreviewPanelProps) {
  if (!previewData && !previewError) return null;

  return (
    <div className="flex-[0_0_40%] min-w-[400px] max-w-[600px] border-l border-[var(--color-border)] bg-[var(--color-background)] flex flex-col overflow-hidden transition-transform duration-300 ease-in-out">
      {previewError ? (
        <>
          <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] flex-shrink-0 bg-[var(--color-background)] sticky top-0 z-10">
            <div className="flex-1 min-w-0 pr-4">
              <h2 className="text-lg font-semibold text-[var(--color-error)] truncate">
                Preview Error
              </h2>
              {previewErrorPath && (
                <p className="text-sm text-[var(--color-foreground)]/60 truncate font-mono mt-1">
                  {previewErrorPath}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 text-[var(--color-foreground)]/60 hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)] rounded transition-colors flex-shrink-0"
              title="Close preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center">
            <div className="text-center max-w-md">
              <AlertCircle className="w-12 h-12 text-[var(--color-error)] mx-auto mb-4" />
              <p className="text-[var(--color-error)] mb-6 text-base">
                {previewError}
              </p>
              {previewErrorPath && previewError.toLowerCase().includes('too large') && (
                <button
                  onClick={() => {
                    if (previewErrorPath) {
                      onOpenPath(previewErrorPath);
                      onClose();
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/80 text-white rounded-lg transition-colors mx-auto"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open with System Application
                </button>
              )}
            </div>
          </div>
        </>
      ) : previewData ? (
        <>
          <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] flex-shrink-0 bg-[var(--color-background)] sticky top-0 z-10">
            <div className="flex-1 min-w-0 pr-4">
              <h2 className="text-lg font-semibold text-[var(--color-foreground)] truncate">
                {previewData.name}
              </h2>
              <p className="text-sm text-[var(--color-foreground)]/60 truncate font-mono">
                {previewData.path}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => onOpenPath(previewData.path)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-muted)] rounded transition-colors"
                title="Open with system application"
              >
                <ExternalLink className="w-4 h-4" />
                Open
              </button>
              <button
                onClick={onClose}
                className="p-2 text-[var(--color-foreground)]/60 hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)] rounded transition-colors"
                title="Close preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

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
        </>
      ) : null}
    </div>
  );
}
