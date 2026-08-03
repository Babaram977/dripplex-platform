import { BORDER, G2, G3, MUTED } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

/**
 * Product name / merchant+rating row / price row / meta chips block,
 * ported from the "Product Info" section of the locked Figma Make Product
 * Detail screen. The source also renders a cashback badge and a
 * "soldCount" figure next to the rating — both dropped here since neither
 * has a real backend field (`ProductDetailDto` has no cashback or
 * sold-count concept) rather than fabricate them for a live page.
 */
export function SuperAppProductInfoHeader({
  name,
  merchantName,
  merchantVerified = false,
  ratingAverage,
  ratingCount,
  priceLabel,
  originalPriceLabel,
  discountLabel,
  categoryLabel,
  availabilityLabel,
  outOfStock,
  skuLabel,
}: {
  name: string;
  merchantName?: string | undefined;
  merchantVerified?: boolean | undefined;
  ratingAverage: number;
  ratingCount: number;
  priceLabel: string;
  originalPriceLabel?: string | undefined;
  discountLabel?: string | undefined;
  categoryLabel?: string | undefined;
  availabilityLabel: string;
  outOfStock: boolean;
  skuLabel?: string | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div className="px-5 pb-2 pt-4">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h1
          className={`flex-1 text-[22px] font-bold leading-tight text-white ${heading}`}
          style={{ letterSpacing: '-0.02em' }}
        >
          {name}
        </h1>
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {merchantName ? (
            <span className={`text-[13px] ${body}`} style={{ color: MUTED }}>
              {merchantName}
            </span>
          ) : null}
          {merchantVerified ? (
            <div
              className="flex h-4 w-4 items-center justify-center rounded-full"
              style={{ background: G2 }}
            >
              <svg
                width="9"
                height="9"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#F59E0B">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <span className={`text-[13px] font-semibold text-white ${body}`}>
            {ratingAverage.toFixed(1)}
          </span>
          <span className={`text-[12px] ${body}`} style={{ color: MUTED }}>
            ({ratingCount.toLocaleString()})
          </span>
        </div>
      </div>

      <div className="mb-3 flex items-baseline gap-3">
        <span
          className={`text-[28px] font-bold text-white ${heading}`}
          style={{ letterSpacing: '-0.03em' }}
        >
          {priceLabel}
        </span>
        {originalPriceLabel ? (
          <span className={`text-[15px] line-through ${body}`} style={{ color: MUTED }}>
            {originalPriceLabel}
          </span>
        ) : null}
        {discountLabel ? (
          <span
            className={`rounded-full px-2 py-0.5 text-[12px] font-bold ${body}`}
            style={{
              background: 'rgba(239,68,68,.15)',
              color: '#F87171',
              border: '1px solid rgba(239,68,68,.25)',
            }}
          >
            {discountLabel} OFF
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {categoryLabel ? (
          <span
            className={`flex h-[24px] items-center rounded-full px-3 text-[11px] font-medium ${body}`}
            style={{
              background: 'rgba(255,255,255,.06)',
              border: `1px solid ${BORDER}`,
              color: MUTED,
            }}
          >
            {categoryLabel}
          </span>
        ) : null}
        <span
          className={`flex h-[24px] items-center gap-1 rounded-full px-3 text-[11px] font-medium ${body}`}
          style={{
            background: outOfStock ? 'rgba(248,113,113,.1)' : 'rgba(43,172,82,.1)',
            border: `1px solid ${outOfStock ? 'rgba(248,113,113,.25)' : 'rgba(43,172,82,.25)'}`,
            color: outOfStock ? '#F87171' : G3,
          }}
        >
          <div
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: outOfStock ? '#EF4444' : G3 }}
          />
          {availabilityLabel}
        </span>
        {skuLabel ? (
          <span
            className={`flex h-[24px] items-center rounded-full px-3 text-[11px] ${body}`}
            style={{
              background: 'rgba(255,255,255,.04)',
              border: `1px solid ${BORDER}`,
              color: 'rgba(255,255,255,.28)',
            }}
          >
            {skuLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}
