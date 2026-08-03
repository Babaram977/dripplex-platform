import { BORDER, G0, G2, NAVY_CARD } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

/**
 * Compact merchant row with a "Visit Store" CTA, ported from the merchant
 * section in the locked Figma Make Product Detail screen. The source's
 * `merchant` mock carries `emoji`/`coverBg`/`isVerified`/`rating`/
 * `reviewCount`, none of which exist on the real `ProductMerchantSummaryDto`
 * (merchantId/businessName/logoUrl/city/state only) — this renders the
 * logo (or an initial fallback), name, and city/state, and omits the
 * verified badge and rating row rather than fabricate them.
 */
export function SuperAppMerchantMiniCard({
  businessName,
  logoUrl,
  city,
  state,
  onVisitStore,
}: {
  businessName: string;
  logoUrl?: string | null | undefined;
  city?: string | null | undefined;
  state?: string | null | undefined;
  onVisitStore?: (() => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  const location = [city, state].filter(Boolean).join(', ');

  return (
    <div
      className="mx-5 mb-4 rounded-2xl p-4"
      style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl"
          style={{ background: 'rgba(255,255,255,.06)' }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className={`text-[18px] font-bold text-white ${heading}`}>
              {businessName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[14px] font-semibold text-white ${heading}`}>
            {businessName}
          </p>
          {location ? (
            <p
              className={`truncate text-[12px] ${body}`}
              style={{ color: 'rgba(255,255,255,.38)' }}
            >
              {location}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onVisitStore}
          className={`h-[34px] shrink-0 rounded-full px-4 text-[12px] font-semibold text-white transition-all active:scale-95 ${heading}`}
          style={{
            background: `linear-gradient(135deg,${G0},${G2})`,
            boxShadow: '0 6px 18px rgba(43,172,82,.3)',
          }}
        >
          Visit Store
        </button>
      </div>
    </div>
  );
}
