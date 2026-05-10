import { ChevronRight } from 'lucide-react';
import { formatDirectoriesText } from './types';

interface BreadcrumbAddressProps {
  searchQuery: string;
  selectedDirectories: string[];
}

/**
 * Windows Explorer–style location line: scope + current search (browse-by-folder is future work).
 */
export function BreadcrumbAddress({ searchQuery, selectedDirectories }: BreadcrumbAddressProps) {
  const scope = formatDirectoriesText(selectedDirectories);
  const q = searchQuery.trim();
  const tail = q ? `Search: "${q}"` : 'Enter a search query';

  return (
    <nav
      aria-label="Current location"
      className="flex items-center gap-1 text-sm text-[var(--color-foreground)]/80 min-w-0 py-2 px-1 border-b border-[var(--color-border)]/60"
    >
      <span className="truncate font-medium text-[var(--color-foreground)]">{scope}</span>
      <ChevronRight className="w-4 h-4 flex-shrink-0 opacity-50" aria-hidden />
      <span className="truncate text-[var(--color-foreground)]/70">{tail}</span>
    </nav>
  );
}
