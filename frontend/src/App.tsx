import { Theme } from './components/ui/theme';
import { StatusBar } from './components/StatusBar';
import { DirectorySidebar } from './components/explorer/DirectorySidebar';
import { PreviewPanel } from './components/explorer/PreviewPanel';
import { ExplorerContent } from './components/explorer/ExplorerContent';
import { useExplorerController } from './components/explorer/useExplorerController';

export default function App() {
  const controller = useExplorerController();
  const { previewData, previewError } = controller;

  return (
    <div className="h-screen bg-[var(--color-background)] flex overflow-hidden">
      <DirectorySidebar
        selectedDirectories={controller.selectedDirectories}
        onToggle={controller.handleDirectoryToggle}
      />

      <div
        className={`flex flex-col overflow-hidden transition-all duration-300 ${
          previewData ? 'flex-[0_0_60%]' : 'flex-1'
        }`}
      >
        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
          <h1 className="text-[var(--color-foreground)] text-3xl font-bold tracking-tight">
            File Explorer
          </h1>
          <Theme variant="button" size="md" />
        </div>

        <ExplorerContent controller={controller} />
      </div>

      <StatusBar status={controller.status} />

      {(previewData || previewError) && (
        <PreviewPanel
          previewData={controller.previewData}
          previewError={controller.previewError}
          previewErrorPath={controller.previewErrorPath}
          onClose={controller.closePreview}
          onOpenPath={controller.openPathWithSystem}
        />
      )}
    </div>
  );
}
