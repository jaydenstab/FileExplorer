import { Theme } from './components/ui/theme';
import { StatusBar } from './components/StatusBar';
import { DirectorySidebar } from './components/explorer/DirectorySidebar';
import { PreviewPanel } from './components/explorer/PreviewPanel';
import { ExplorerContent } from './components/explorer/ExplorerContent';
import { useExplorerController } from './components/explorer/useExplorerController';

const PREVIEW_PANE_WIDTH = 420;
const MAIN_MIN_WIDTH_WHEN_PREVIEW_OPEN = 360;

export default function App() {
  const controller = useExplorerController();
  const { preview, feedback, recent } = controller;

  const hasPreview = !!(
    preview.previewData ||
    preview.previewError ||
    preview.isClosing ||
    preview.isPreviewLoading
  );

  return (
    <div className="h-screen bg-[var(--color-background)] flex overflow-hidden">
      <DirectorySidebar
        directories={controller.documentRoots}
        selectedDirectories={controller.filters.selectedDirectories}
        onToggle={controller.filters.handleDirectoryToggle}
        recentFiles={recent.files}
        recentLoading={recent.isLoading}
        recentError={recent.error}
        onRecentFileClick={(file) => controller.preview.handleFileClick(file, 'preview')}
        onRenameDocumentRoot={controller.rename.openRenameDialogForRoot}
      />

      {/* Two-column shell: results area + docked preview pane */}
      <div className="flex-1 flex min-w-0 overflow-hidden">
        {/* Main content column - flexes to fill; min-width keeps results readable when preview is open */}
        <div
          className="flex-1 flex flex-col overflow-hidden min-w-0 transition-[min-width] duration-300 ease-out"
          style={hasPreview ? { minWidth: `min(${MAIN_MIN_WIDTH_WHEN_PREVIEW_OPEN}px, 45%)` } : undefined}
        >
          <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)] flex-shrink-0">
            <h1 className="text-[var(--color-foreground)] text-3xl font-bold tracking-tight">
              File Explorer
            </h1>
            <Theme variant="button" size="md" />
          </div>

          <ExplorerContent controller={controller} />
        </div>

        {/* Docked preview pane - fixed width, anchored to right edge */}
        <div
          className="flex-shrink-0 h-full overflow-hidden transition-[width] duration-300 ease-out"
          style={{ width: hasPreview ? PREVIEW_PANE_WIDTH : 0 }}
        >
          {hasPreview && (
            <PreviewPanel
              previewData={preview.previewData}
              previewError={preview.previewError}
              previewErrorPath={preview.previewErrorPath}
              isPreviewLoading={preview.isPreviewLoading}
              onClose={preview.closePreview}
              onOpenPath={preview.openPathWithSystem}
            />
          )}
        </div>
      </div>

      <StatusBar status={feedback.status} />
    </div>
  );
}
