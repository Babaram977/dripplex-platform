import { G3, MUTED } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

/**
 * "<Title>  ·  See all →" row used above every horizontal scroller
 * (Categories, Nearby Merchants, Recommended, Recent Activity, ...) —
 * ported from `Row` in the locked Figma Make export's screen files.
 *
 * `subtitle` and `showSeeAll` are additive params for the Marketplace
 * screen's `SRow` variant (which adds a subtitle line and, unlike Home's
 * `Row`, hides "See all" entirely when no handler is given instead of
 * falling back to inert text). Both default to Home's original exact
 * behavior — `subtitle` unset, `showSeeAll` true — so this stays a
 * no-visual-change addition for the already-Locked Home usage.
 */
export function SuperAppSectionHeader({
  title,
  subtitle,
  onSeeAll,
  showSeeAll = true,
}: {
  title: string;
  subtitle?: string | undefined;
  onSeeAll?: (() => void) | undefined;
  showSeeAll?: boolean | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  // Home's original `Row` used `items-center` with no bottom padding on the
  // trailing text; Marketplace's `SRow` (which adds the subtitle line) uses
  // `items-end` + `pb-0.5` so the trailing text sits flush with the title's
  // baseline instead of the subtitle's. Switching only when a subtitle is
  // present keeps Home's already-Locked rendering byte-for-byte unchanged.
  const alignClass = subtitle ? 'items-end' : 'items-center';
  const seeAllPadding = subtitle ? 'pb-0.5' : '';
  return (
    <div className={`mb-3 flex ${alignClass} justify-between px-5`}>
      <div>
        <p className={`text-[15px] font-bold leading-tight ${heading}`} style={{ color: '#FFF' }}>
          {title}
        </p>
        {subtitle ? (
          <p className={`mt-0.5 text-[10px] ${body}`} style={{ color: MUTED }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {showSeeAll ? (
        onSeeAll ? (
          <button
            type="button"
            onClick={onSeeAll}
            className={`${seeAllPadding} text-[12px] font-semibold ${body}`}
            style={{ color: G3 }}
          >
            See all →
          </button>
        ) : (
          <span
            className={`${seeAllPadding} text-[12px] font-semibold ${body}`}
            style={{ color: G3 }}
          >
            See all →
          </span>
        )
      ) : null}
    </div>
  );
}
