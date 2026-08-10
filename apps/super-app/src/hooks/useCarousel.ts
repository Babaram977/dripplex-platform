import { useState, useEffect } from 'react';
import { DURATION } from '../tokens/animations';

interface CarouselResult {
  index: number;
  fade: boolean;
  goTo: (i: number) => void;
  next: () => void;
  previous: () => void;
}

// Auto-advancing carousel with cross-fade transition support.
export function useCarousel(total: number, intervalMs = DURATION.carousel): CarouselResult {
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(false);

  const advance = (next: number) => {
    setFade(true);
    setTimeout(() => {
      setIndex(next);
      setFade(false);
    }, 200);
  };

  useEffect(() => {
    if (total <= 1) return;
    const t = setInterval(() => advance((index + 1) % total), intervalMs);
    return () => clearInterval(t);
  }, [index, total, intervalMs]);

  return {
    index,
    fade,
    goTo: (i) => advance(i),
    next: () => advance((index + 1) % total),
    previous: () => advance((index - 1 + total) % total),
  };
}
