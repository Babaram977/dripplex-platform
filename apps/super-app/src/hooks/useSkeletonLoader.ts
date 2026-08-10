import { useState, useEffect } from 'react';

// Returns `loaded: true` after `delayMs` milliseconds.
// Use to simulate or gate real async data loads behind skeleton screens.
export function useSkeletonLoader(delayMs = 900): boolean {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);

  return loaded;
}
