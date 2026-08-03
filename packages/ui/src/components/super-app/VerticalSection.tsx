import { Fragment } from 'react';

import { BORDER, NAVY_CARD } from '../../tokens/colors';

import { SuperAppSectionHeader } from './SectionHeader';

/**
 * Section header over a single bordered card containing divider-separated
 * rows (skeleton or real, same container either way) — the shape used by
 * Marketplace's `NearbyBusinesses` and matching Home's (Locked, bespoke)
 * `SuperAppActivityList`. Extracted here since a second real instance
 * showed up; `SuperAppActivityList` itself is left untouched since it's
 * already Locked.
 */
export function SuperAppVerticalListCard<T>({
  title,
  subtitle,
  onSeeAll,
  items,
  loaded,
  skeletonCount,
  renderSkeletonRow,
  renderItem,
  keyExtractor,
}: {
  title: string;
  subtitle?: string | undefined;
  onSeeAll?: (() => void) | undefined;
  items: T[];
  loaded: boolean;
  skeletonCount: number;
  renderSkeletonRow: (index: number, isLast: boolean) => React.ReactNode;
  renderItem: (item: T, index: number, isLast: boolean) => React.ReactNode;
  keyExtractor: (item: T) => string;
}): React.JSX.Element {
  return (
    <div className="mb-5">
      <SuperAppSectionHeader title={title} subtitle={subtitle} onSeeAll={onSeeAll} />
      <div className="flex flex-col gap-0 px-5">
        <div
          className="overflow-hidden rounded-3xl"
          style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
        >
          {!loaded
            ? Array.from({ length: skeletonCount }).map((_, i) => (
                <Fragment key={i}>{renderSkeletonRow(i, i === skeletonCount - 1)}</Fragment>
              ))
            : items.map((item, i) => (
                <Fragment key={keyExtractor(item)}>
                  {renderItem(item, i, i === items.length - 1)}
                </Fragment>
              ))}
        </div>
      </div>
    </div>
  );
}
