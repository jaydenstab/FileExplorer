import { X, ExternalLink, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import type { ZoomSensitivity } from './usePreviewZoomPreferences';

interface PreviewHeaderLoadingProps {
  variant: 'loading';
  onClose: () => void;
}

interface PreviewHeaderErrorProps {
  variant: 'error';
  previewErrorPath: string | null;
  onClose: () => void;
}

interface PreviewHeaderSuccessProps {
  variant: 'success';
  name: string;
  path: string;
  onClose: () => void;
  onOpenPath: (path: string) => void;
  hasZoomControls: boolean;
  isTextPreview: boolean;
  zoomPercent: number;
  wrapLines: boolean;
  sensitivity: ZoomSensitivity;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onSensitivityChange: (v: ZoomSensitivity) => void;
  onWrapToggle: () => void;
}

type PreviewHeaderProps =
  | PreviewHeaderLoadingProps
  | PreviewHeaderErrorProps
  | PreviewHeaderSuccessProps;

const headerBaseClasses =
  'flex items-center justify-between p-3 border-b border-[var(--color-border)] flex-shrink-0 bg-[var(--color-background)]';

export function PreviewHeader(props: PreviewHeaderProps) {
  if (props.variant === 'loading') {
    return (
      <div className={headerBaseClasses}>
        <h2 className="text-lg font-semibold text-[var(--color-foreground)]/70">
          Loading preview…
        </h2>
        <button
          onClick={props.onClose}
          className="p-2 text-[var(--color-foreground)]/60 hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)] rounded transition-colors flex-shrink-0"
          title="Close preview"
          aria-label="Close preview"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    );
  }

  if (props.variant === 'error') {
    return (
      <div className={headerBaseClasses}>
        <div className="flex-1 min-w-0 pr-4">
          <h2 className="text-lg font-semibold text-[var(--color-error)] truncate">
            Preview Error
          </h2>
          {props.previewErrorPath && (
            <p className="text-sm text-[var(--color-foreground)]/60 truncate font-mono mt-1">
              {props.previewErrorPath}
            </p>
          )}
        </div>
        <button
          onClick={props.onClose}
          className="p-2 text-[var(--color-foreground)]/60 hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)] rounded transition-colors flex-shrink-0"
          title="Close preview"
          aria-label="Close preview"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    );
  }

  const {
    name,
    path,
    onClose,
    onOpenPath,
    hasZoomControls,
    isTextPreview,
    zoomPercent,
    wrapLines,
    sensitivity,
    onZoomIn,
    onZoomOut,
    onZoomReset,
    onSensitivityChange,
    onWrapToggle,
  } = props;

  return (
    <div className={headerBaseClasses}>
      <div className="flex-1 min-w-0 pr-4">
        <h2 className="text-lg font-semibold text-[var(--color-foreground)] truncate">
          {name}
        </h2>
        <p className="text-sm text-[var(--color-foreground)]/60 truncate font-mono">
          {path}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {hasZoomControls && (
          <>
            <div
              className="flex items-center gap-1 mr-2"
              title="Cmd/Ctrl + scroll to zoom"
            >
              <button
                onClick={onZoomOut}
                className="p-1.5 text-[var(--color-foreground)]/70 hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)] rounded transition-colors"
                title="Zoom out"
                aria-label="Zoom out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span
                className="text-xs text-[var(--color-foreground)]/60 min-w-[2.5rem] text-center"
                aria-live="polite"
              >
                {zoomPercent}%
              </span>
              <button
                onClick={onZoomIn}
                className="p-1.5 text-[var(--color-foreground)]/70 hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)] rounded transition-colors"
                title="Zoom in"
                aria-label="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={onZoomReset}
                className="p-1.5 text-[var(--color-foreground)]/70 hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)] rounded transition-colors"
                title={isTextPreview ? 'Reset zoom' : 'Reset zoom (fit page width)'}
                aria-label={isTextPreview ? 'Reset zoom' : 'Reset zoom to fit page width'}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <div
                className="flex items-center gap-0.5 ml-1"
                title="Zoom sensitivity: S=slow, N=normal, F=fast"
                role="group"
                aria-label="Zoom sensitivity"
              >
                {(['slow', 'normal', 'fast'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => onSensitivityChange(s)}
                    className={`w-6 h-6 text-[10px] font-medium rounded transition-colors ${
                      sensitivity === s
                        ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                        : 'text-[var(--color-foreground)]/50 hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)]'
                    }`}
                    title={`Sensitivity: ${s}`}
                    aria-label={`Sensitivity ${s}`}
                    aria-pressed={sensitivity === s}
                  >
                    {s === 'slow' ? 'S' : s === 'normal' ? 'N' : 'F'}
                  </button>
                ))}
              </div>
            </div>
            {isTextPreview && (
              <button
                onClick={onWrapToggle}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  wrapLines
                    ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                    : 'text-[var(--color-foreground)]/70 hover:bg-[var(--color-muted)]'
                }`}
                title={
                  wrapLines
                    ? 'Disable line wrap (enable horizontal scroll)'
                    : 'Wrap lines'
                }
                aria-label={wrapLines ? 'Disable line wrap' : 'Wrap lines'}
              >
                {wrapLines ? 'Wrap' : 'No wrap'}
              </button>
            )}
          </>
        )}
        <button
          onClick={() => onOpenPath(path)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-muted)] rounded transition-colors"
          title="Open with system application"
          aria-label="Open with system application"
        >
          <ExternalLink className="w-4 h-4" />
          Open
        </button>
        <button
          onClick={onClose}
          className="p-2 text-[var(--color-foreground)]/60 hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)] rounded transition-colors"
          title="Close preview"
          aria-label="Close preview"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
