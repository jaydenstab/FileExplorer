import { Folder } from 'lucide-react';
import { AVAILABLE_DIRECTORIES } from './types';

export interface DirectorySidebarProps {
  selectedDirectories: string[];
  onToggle: (directory: string) => void;
}

export function DirectorySidebar({ selectedDirectories, onToggle }: DirectorySidebarProps) {
  return (
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
                onClick={() => onToggle(directory)}
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
  );
}
