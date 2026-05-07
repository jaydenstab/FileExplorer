import { useState, useEffect, useRef } from 'react';

interface UseDebouncedValueOptions<T> {
  /** When true, update immediately without debounce (e.g. when clearing). Use a stable callback. */
  immediateWhen?: (value: T) => boolean;
}

/**
 * Returns a debounced version of the given value.
 * Updates after `delayMs` of no changes to the source value.
 */
export function useDebouncedValue<T>(
  value: T,
  delayMs: number,
  options?: UseDebouncedValueOptions<T>
): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const timeoutRef = useRef<number | null>(null);
  const immediateWhen = options?.immediateWhen;

  useEffect(() => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);

    if (immediateWhen?.(value)) {
      setDebouncedValue(value);
      return;
    }

    if (value === debouncedValue) return;

    timeoutRef.current = window.setTimeout(() => {
      setDebouncedValue(value);
      timeoutRef.current = null;
    }, delayMs);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [value, delayMs, debouncedValue, immediateWhen]);

  return debouncedValue;
}
