import * as React from 'react';

/**
 * Attaches an IntersectionObserver to the returned ref; calls onLoadMore
 * once whenever the sentinel scrolls into view and hasMore is true. Safe to
 * call onLoadMore repeatedly — callers are expected to guard against
 * concurrent loads (e.g. a `loading` flag) themselves.
 */
export function useInfiniteScroll(
  onLoadMore: () => void,
  { hasMore, disabled = false }: { hasMore: boolean; disabled?: boolean },
): React.RefObject<HTMLDivElement | null> {
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = React.useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  React.useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || disabled) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMoreRef.current();
        }
      },
      { rootMargin: '400px' },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [hasMore, disabled]);

  return sentinelRef;
}
