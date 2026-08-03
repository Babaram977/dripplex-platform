import { BORDER, G0, G2, G3, MUTED, NAVY_CARD } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

/**
 * "Added to Cart!" bottom sheet, ported from `CartSheet` in the locked
 * Figma Make Product Detail screen. Renders a real product image when the
 * backend provides one instead of the source's emoji thumbnail.
 */
export function SuperAppCartConfirmationSheet({
  productName,
  priceLabel,
  quantity,
  imageUrl,
  onContinueShopping,
  onViewCart,
}: {
  productName: string;
  priceLabel: string;
  quantity: number;
  imageUrl?: string | null | undefined;
  onContinueShopping?: (() => void) | undefined;
  onViewCart?: (() => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div
      className="absolute inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,.72)' }}
      onClick={onContinueShopping}
    >
      <div
        className="flex flex-col gap-5 rounded-t-[32px] p-6"
        style={{
          background: NAVY_CARD,
          border: `1px solid ${BORDER}`,
          animation: 'fade-up .28s ease both',
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div
          className="mx-auto h-1 w-10 rounded-full"
          style={{ background: 'rgba(255,255,255,.2)' }}
        />
        <div className="flex items-center gap-4">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl"
            style={{ background: 'rgba(255,255,255,.06)' }}
          >
            {imageUrl ? (
              <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span style={{ fontSize: 32, opacity: 0.3 }}>📦</span>
            )}
          </div>
          <div className="flex-1">
            <p className={`text-[15px] font-semibold text-white ${heading}`}>{productName}</p>
            <p className={`text-[13px] ${body}`} style={{ color: MUTED }}>
              Qty: {quantity} · {priceLabel}
            </p>
          </div>
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'rgba(43,172,82,.2)', border: '1.5px solid rgba(43,172,82,.35)' }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke={G3}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className={`text-center text-[13px] font-semibold ${body}`} style={{ color: G3 }}>
            Added to Cart!
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onContinueShopping}
              className={`h-[50px] flex-1 rounded-2xl text-[14px] font-medium transition-all active:scale-[.97] ${heading}`}
              style={{
                background: 'rgba(255,255,255,.06)',
                border: `1.5px solid ${BORDER}`,
                color: MUTED,
              }}
            >
              Continue Shopping
            </button>
            <button
              type="button"
              onClick={onViewCart}
              className={`h-[50px] flex-1 rounded-2xl text-[14px] font-semibold text-white transition-all active:scale-[.97] ${heading}`}
              style={{
                background: `linear-gradient(135deg,${G0},${G2} 55%,${G3})`,
                boxShadow: '0 10px 32px rgba(43,172,82,.36)',
              }}
            >
              View Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
