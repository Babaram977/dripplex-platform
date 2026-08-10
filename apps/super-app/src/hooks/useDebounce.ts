import { useState, useEffect } from 'react';

// Delays updating a value until the user stops typing for `delay` ms.
// Use for search inputs to avoid firing on every keystroke.
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}
