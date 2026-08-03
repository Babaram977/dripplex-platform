import { BORDER, G0, G2, G3, MUTED, NAVY_CARD } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';
import { SuperAppVerifiedBadge } from './VerifiedBadge';

export interface SuperAppFeaturedMerchant {
  key: string;
  name: string;
  category: string;
  rating: number;
  distance: string;
  eta: string;
  deliveryFee: string;
  isFreeDelivery: boolean;
  open: boolean;
  verified: boolean;
  background: string;
  emoji: string;
  tag: string;
  tagColor: string;
}

/**
 * Full-width featured-merchant card (cover photo + tag + info row + CTA),
 * ported from the merchant card markup inside `FeaturedMerchants` in the
 * locked Figma Make Marketplace screen.
 */
export function SuperAppFeaturedMerchantCard({
  merchant,
  onVisit,
}: {
  merchant: SuperAppFeaturedMerchant;
  onVisit?: (() => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div
      className="overflow-hidden rounded-3xl"
      style={{
        background: NAVY_CARD,
        border: `1.5px solid ${BORDER}`,
        boxShadow: '0 4px 20px rgba(0,0,0,.28)',
      }}
    >
      <div
        className="relative flex h-[88px] items-center justify-center"
        style={{ background: merchant.background }}
      >
        <span style={{ fontSize: 44 }}>{merchant.emoji}</span>
        <div className="absolute left-3 top-3">
          <span
            className={`rounded-lg px-2 py-1 text-[9px] font-bold ${body}`}
            style={{
              background: `${merchant.tagColor}22`,
              color: merchant.tagColor,
              border: `1px solid ${merchant.tagColor}35`,
              backdropFilter: 'blur(4px)',
            }}
          >
            {merchant.tag}
          </span>
        </div>
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          {!merchant.open ? (
            <span
              className={`rounded-lg px-2 py-1 text-[9px] font-bold ${body}`}
              style={{
                background: 'rgba(239,68,68,.2)',
                color: '#FCA5A5',
                border: '1px solid rgba(239,68,68,.25)',
              }}
            >
              Closed
            </span>
          ) : null}
          <span
            className={`rounded-lg px-2 py-1 text-[9px] font-bold ${body}`}
            style={{ background: 'rgba(0,0,0,.45)', color: '#FFF', backdropFilter: 'blur(6px)' }}
          >
            ⏱ {merchant.eta}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 p-3.5">
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-2">
            <p className={`truncate text-[13.5px] font-bold ${heading}`} style={{ color: '#FFF' }}>
              {merchant.name}
            </p>
            {merchant.verified ? <SuperAppVerifiedBadge /> : null}
          </div>
          <p className={`mb-1.5 text-[10px] ${body}`} style={{ color: MUTED }}>
            {merchant.category}
          </p>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold" style={{ color: '#FBBF24' }}>
              ★ {merchant.rating}
            </span>
            <span className={`text-[10px] ${body}`} style={{ color: MUTED }}>
              📍 {merchant.distance}
            </span>
            <span
              className={`text-[10px] ${body}`}
              style={{ color: merchant.isFreeDelivery ? G3 : MUTED }}
            >
              🚚 {merchant.deliveryFee}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={merchant.open ? onVisit : undefined}
          className={`h-9 flex-shrink-0 rounded-xl px-4 text-[11px] font-semibold transition-all active:scale-95 ${body}`}
          style={{
            background: merchant.open
              ? `linear-gradient(135deg,${G0},${G2})`
              : 'rgba(255,255,255,.07)',
            color: merchant.open ? '#FFF' : 'rgba(255,255,255,.3)',
            boxShadow: merchant.open ? '0 3px 12px rgba(43,172,82,.22)' : 'none',
          }}
        >
          {merchant.open ? 'Visit Store' : 'Closed'}
        </button>
      </div>
    </div>
  );
}
