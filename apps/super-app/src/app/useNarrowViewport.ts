import { useEffect, useState } from 'react';

/**
 * Is the viewport too narrow to hold a permanent sidebar beside real content?
 *
 * Both the Operations console and the Merchant portal are desktop layouts with
 * a fixed-width navigation column. On a phone that column is most of the
 * screen — 200-220px of a 390pt viewport — and because both shells clip
 * overflow, the content beside it is not merely squeezed, it is unreachable at
 * any zoom level.
 *
 * 900px is the point below which that stops being a convenience and starts
 * being the whole problem. Above it, nothing changes: the desktop layout both
 * portals were designed for is left exactly as it was.
 *
 * This lives in its own module, with no dependency beyond React, so the two
 * portals share one definition. The console had a private copy first; a second
 * copy in the merchant portal is how two things that must agree quietly stop
 * agreeing.
 */
export function useNarrowViewport(maxWidth = 900): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(`(max-width: ${maxWidth}px)`).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener('change', onChange);
    // Re-read on mount: the initial state was computed before this effect ran,
    // and a resize between the two would otherwise be missed.
    setNarrow(mq.matches);
    return () => mq.removeEventListener('change', onChange);
  }, [maxWidth]);
  return narrow;
}
