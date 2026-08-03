import { Fragment } from 'react';

import { SuperAppSectionHeader } from './SectionHeader';
import { SuperAppSkeleton } from './Skeleton';

/**
 * The "SectionHeader + horizontally-scrolling row + skeleton loading
 * state" shell repeated across Home's Merchants/Recommendations sections
 * (and every other screen's horizontal card rows). Callers supply the
 * item renderer so this owns only the repeated layout/loading chrome, not
 * card content.
 */
export function SuperAppHorizontalSection<T>({
  title,
  onSeeAll,
  items,
  loaded,
  skeletonCount,
  skeletonWidth,
  skeletonHeight,
  renderItem,
  keyExtractor,
}: {
  title: string;
  onSeeAll?: (() => void) | undefined;
  items: T[];
  loaded: boolean;
  skeletonCount: number;
  skeletonWidth: number;
  skeletonHeight: number;
  renderItem: (item: T) => React.ReactNode;
  keyExtractor: (item: T) => string;
}): React.JSX.Element {
  return (
    <div className="mb-5">
      <SuperAppSectionHeader title={title} onSeeAll={onSeeAll} />
      <div className="flex gap-3 overflow-x-auto px-5" style={{ scrollbarWidth: 'none' }}>
        {!loaded
          ? Array.from({ length: skeletonCount }).map((_, i) => (
              <SuperAppSkeleton key={i} w={skeletonWidth} h={skeletonHeight} />
            ))
          : items.map((item) => <Fragment key={keyExtractor(item)}>{renderItem(item)}</Fragment>)}
      </div>
    </div>
  );
}
