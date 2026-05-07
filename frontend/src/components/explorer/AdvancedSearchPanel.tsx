import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import { DISTANCE_MIN, DISTANCE_MAX } from './types';

interface AdvancedSearchPanelProps {
  expanded: boolean;
  onToggle: () => void;
  searchMode: 'semantic' | 'text';
  onSearchModeChange: (mode: 'semantic' | 'text') => void;
  minConfidence: '' | 'high' | 'medium' | 'low';
  onMinConfidenceChange: (value: '' | 'high' | 'medium' | 'low') => void;
  distanceThreshold: string;
  onDistanceThresholdChange: (value: string) => void;
  useReranker: boolean;
  onUseRerankerChange: (value: boolean) => void;
  selectedFileTypes: string[];
  onFileTypeToggle: (ext: string) => void;
  isDistanceInvalid: boolean;
  onResetFilters: () => void;
}

export function AdvancedSearchPanel({
  expanded,
  onToggle,
  searchMode,
  onSearchModeChange,
  minConfidence,
  onMinConfidenceChange,
  distanceThreshold,
  onDistanceThresholdChange,
  useReranker,
  onUseRerankerChange,
  selectedFileTypes,
  onFileTypeToggle,
  isDistanceInvalid,
  onResetFilters,
}: AdvancedSearchPanelProps) {
  return (
    <div className="mb-8">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-sm text-[var(--color-foreground)]/70 hover:text-[var(--color-foreground)] transition-colors"
      >
        <SlidersHorizontal className="w-4 h-4" />
        Advanced search
        {expanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>
      {expanded && (
        <div className="mt-4 p-4 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg space-y-4">
          <div>
            <span className="block text-xs font-medium text-[var(--color-foreground)]/60 mb-2">
              Search mode
            </span>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-[var(--color-foreground)]/80 cursor-pointer">
                <input
                  type="radio"
                  name="search-mode"
                  checked={searchMode === 'semantic'}
                  onChange={() => onSearchModeChange('semantic')}
                  className="rounded border-[var(--color-border)]"
                />
                Semantic (embeddings)
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--color-foreground)]/80 cursor-pointer">
                <input
                  type="radio"
                  name="search-mode"
                  checked={searchMode === 'text'}
                  onChange={() => onSearchModeChange('text')}
                  className="rounded border-[var(--color-border)]"
                />
                Literal text (substring)
              </label>
            </div>
            <p className="text-xs text-[var(--color-foreground)]/50 mt-2">
              Literal mode scans file contents for exact substrings (bounded I/O per file). Semantic mode uses the vector index.
            </p>
          </div>
          <p className="text-xs text-[var(--color-foreground)]/50">
            Min relevance: reranker match score (when Use reranker is on); higher = better. Max distance: embedding distance (lower = better); valid range 0–2. Ignored in literal text mode.
          </p>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-[var(--color-foreground)]/60 mb-1" title="Reranker match score (when Use reranker is on)">
                Min relevance
              </label>
              <select
                value={minConfidence}
                onChange={(e) => onMinConfidenceChange((e.target.value || '') as '' | 'high' | 'medium' | 'low')}
                disabled={!useReranker || searchMode === 'text'}
                className="px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-foreground)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Any</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              {!useReranker && (
                <p className="text-xs text-[var(--color-foreground)]/50 mt-1">Only applies when Use reranker is on</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-foreground)]/60 mb-1">
                Max distance <span className="text-[var(--color-foreground)]/50 font-normal">(0–2)</span>
              </label>
              <input
                type="number"
                min={DISTANCE_MIN}
                max={DISTANCE_MAX}
                step={0.1}
                value={distanceThreshold}
                onChange={(e) => onDistanceThresholdChange(e.target.value)}
                placeholder="0–2"
                disabled={searchMode === 'text'}
                className={`w-24 px-3 py-2 bg-[var(--color-background)] border rounded-lg text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-foreground)]/40 disabled:opacity-50 ${
                  isDistanceInvalid ? 'border-[var(--color-error)]' : 'border-[var(--color-border)]'
                }`}
              />
              {isDistanceInvalid && (
                <p className="text-xs text-[var(--color-error)] mt-1">Enter a value between 0 and 2</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="use-reranker"
                checked={useReranker}
                onChange={(e) => onUseRerankerChange(e.target.checked)}
                disabled={searchMode === 'text'}
                className="rounded border-[var(--color-border)]"
              />
              <label htmlFor="use-reranker" className="text-sm text-[var(--color-foreground)]/80">
                Use reranker
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-foreground)]/60 mb-1">
                File types
              </label>
              <div className="flex gap-2">
                {['pdf', 'txt'].map((ext) => {
                  const isSelected = selectedFileTypes.includes(ext);
                  return (
                    <button
                      key={ext}
                      onClick={() => onFileTypeToggle(ext)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        isSelected
                          ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/50'
                          : 'bg-[var(--color-muted)] text-[var(--color-foreground)]/70 border border-transparent hover:border-[var(--color-border)]'
                      }`}
                    >
                      .{ext}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              onClick={onResetFilters}
              className="px-3 py-2 text-sm text-[var(--color-foreground)]/60 hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)] rounded-lg transition-colors"
            >
              Reset filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
