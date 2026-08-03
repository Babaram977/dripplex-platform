import { G3 } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

/**
 * Small "Verified" merchant badge, ported from `VerifiedBadge` in the
 * locked Figma Make Marketplace screen. Generic enough to reuse on any
 * merchant/store card across the app (Marketplace, Store, Ride driver
 * profile, ...).
 */
export function SuperAppVerifiedBadge(): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <div
      className="flex items-center gap-0.5 rounded-lg px-1.5 py-0.5"
      style={{ background: 'rgba(43,172,82,.15)', border: '1px solid rgba(43,172,82,.25)' }}
    >
      <svg
        width="9"
        height="9"
        viewBox="0 0 24 24"
        fill="none"
        stroke={G3}
        strokeWidth="3"
        strokeLinecap="round"
      >
        <path d="M20 6L9 17l-5-5" />
      </svg>
      <p className={`text-[8px] font-bold ${body}`} style={{ color: G3 }}>
        Verified
      </p>
    </div>
  );
}
