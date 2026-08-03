import { BORDER, G3, MUTED, NAVY_CARD } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';
import { SuperAppSectionHeader } from './SectionHeader';
import { SuperAppSkeleton } from './Skeleton';

export interface SuperAppActivityItem {
  key: string;
  icon: string;
  label: string;
  sub: string;
  amount: string;
  credit: boolean;
}

/**
 * "Recent Activity" vertical list, ported from Home's `ActivityList`. Kept
 * separate from `SuperAppHorizontalSection` since it scrolls vertically
 * with a different skeleton shape (full-width rows, not cards).
 */
export function SuperAppActivityList({
  title = 'Recent Activity',
  items,
  loaded,
  onSeeAll,
}: {
  title?: string | undefined;
  items: SuperAppActivityItem[];
  loaded: boolean;
  onSeeAll?: (() => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div className="mb-4 px-5">
      <SuperAppSectionHeader title={title} onSeeAll={onSeeAll} />
      {!loaded ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <SuperAppSkeleton key={i} w="100%" h={64} r={20} />
          ))}
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-3xl"
          style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
        >
          {items.map((a, i) => (
            <div
              key={a.key}
              className="flex items-center gap-3.5 px-4 py-3.5"
              style={{ borderBottom: i < items.length - 1 ? `1px solid ${BORDER}` : 'none' }}
            >
              <div
                className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-2xl text-[18px]"
                style={{ background: a.credit ? 'rgba(43,172,82,.12)' : 'rgba(255,255,255,.06)' }}
              >
                {a.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-[13px] font-semibold ${heading}`}
                  style={{ color: '#FFF' }}
                >
                  {a.label}
                </p>
                <p className={`text-[10px] ${body}`} style={{ color: MUTED }}>
                  {a.sub}
                </p>
              </div>
              <p
                className={`flex-shrink-0 text-[14px] font-bold ${heading}`}
                style={{ color: a.credit ? G3 : '#FFF' }}
              >
                {a.amount}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
