import { G3 } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

/**
 * "<Title>  ·  See all →" row used above every horizontal scroller
 * (Categories, Nearby Merchants, Recommended, Recent Activity, ...) —
 * ported from `Row` in the locked Figma Make export's screen files.
 */
export function SuperAppSectionHeader({
  title,
  onSeeAll,
}: {
  title: string;
  onSeeAll?: (() => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div className="mb-3 flex items-center justify-between px-5">
      <p className={`text-[15px] font-bold ${heading}`} style={{ color: '#FFF' }}>
        {title}
      </p>
      {onSeeAll ? (
        <button
          type="button"
          onClick={onSeeAll}
          className={`text-[12px] font-semibold ${body}`}
          style={{ color: G3 }}
        >
          See all →
        </button>
      ) : (
        <span className={`text-[12px] font-semibold ${body}`} style={{ color: G3 }}>
          See all →
        </span>
      )}
    </div>
  );
}
