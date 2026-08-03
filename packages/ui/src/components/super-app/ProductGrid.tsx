import { Fragment } from 'react';

import { BORDER, G3, NAVY_CARD } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

/** Skeleton card matching `SuperAppStoreProductCard`'s layout while loading. */
function ProductCardSkeleton(): React.JSX.Element {
  return (
    <div
      className="overflow-hidden rounded-3xl"
      style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
    >
      <div style={{ height: 88, background: 'rgba(255,255,255,.04)' }} />
      <div className="flex flex-col gap-2 p-3">
        <div
          style={{
            height: 11,
            width: '70%',
            borderRadius: 6,
            background: 'rgba(255,255,255,.055)',
          }}
        />
        <div
          style={{ height: 9, width: '50%', borderRadius: 6, background: 'rgba(255,255,255,.04)' }}
        />
        <div
          style={{
            height: 28,
            borderRadius: 12,
            background: 'rgba(255,255,255,.04)',
            marginTop: 4,
          }}
        />
      </div>
    </div>
  );
}

/**
 * 2-column product grid with a section header and loading skeleton,
 * ported from `ProductGrid` in the locked Figma Make Store screen. The
 * header row here has no padding of its own in the source — it inherits
 * `px-4` from this same wrapper — so it's written inline rather than via
 * `SuperAppSectionHeader`, which hardcodes its own `px-5` and would
 * double-indent/mismatch the spacing if nested here.
 */
export function SuperAppProductGrid<T>({
  title,
  onSeeAll,
  items,
  loaded,
  skeletonCount = 4,
  renderItem,
  keyExtractor,
}: {
  title: string;
  onSeeAll?: (() => void) | undefined;
  items: T[];
  loaded: boolean;
  skeletonCount?: number | undefined;
  renderItem: (item: T) => React.ReactNode;
  keyExtractor: (item: T) => string;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div className="mb-5 px-4">
      <div className="mb-3 flex items-center justify-between">
        <p className={`text-[15px] font-bold ${heading}`} style={{ color: '#FFF' }}>
          {title}
        </p>
        <button
          type="button"
          onClick={onSeeAll}
          className={`text-[12px] font-semibold ${body}`}
          style={{ color: G3 }}
        >
          See all →
        </button>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {!loaded
          ? Array.from({ length: skeletonCount }).map((_, i) => <ProductCardSkeleton key={i} />)
          : items.map((item) => <Fragment key={keyExtractor(item)}>{renderItem(item)}</Fragment>)}
      </div>
    </div>
  );
}
