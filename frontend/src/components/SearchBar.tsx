import { useState, useRef, memo } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const SearchBar = memo(function SearchBar({
  value,
  onChange,
  placeholder = 'Search...',
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
  };

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
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
          onBlur={handleBlur}
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
    </div>
  );
});

