import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  suggestions?: string[];
  placeholder?: string;
}

export function SearchBar({
  value,
  onChange,
  suggestions = [],
  placeholder = 'Search...',
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFocus = () => {
    setIsFocused(true);
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion);
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`
          relative flex items-center gap-3 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl
          transition-all duration-300 ease-out
          ${
            isFocused
              ? 'ring-2 ring-[var(--color-primary)]/30 border-[var(--color-primary)]/50 bg-[var(--color-muted)] scale-[1.02]'
              : 'hover:bg-[var(--color-muted)] hover:border-[var(--color-primary)]/30'
          }
        `}
      >
        <Search className="w-5 h-5 text-[var(--color-foreground)]/50 ml-4 flex-shrink-0" />

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-[var(--color-foreground)] placeholder:text-[var(--color-foreground)]/40 py-4 pr-2 outline-none"
        />

        {value && (
          <button
            onClick={handleClear}
            className="mr-4 p-1 rounded-full hover:bg-[var(--color-muted)] transition-colors duration-200"
            aria-label="Clear search"
          >
            <X className="w-4 h-4 text-[var(--color-foreground)]/50 hover:text-[var(--color-foreground)]/70" />
          </button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--color-card)] backdrop-blur-sm border border-[var(--color-border)] rounded-xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200 z-10">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className="w-full text-left px-4 py-3 text-[var(--color-foreground)]/80 hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors duration-150 flex items-center gap-2"
            >
              <Search className="w-4 h-4 text-[var(--color-foreground)]/40" />
              <span>{suggestion}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

