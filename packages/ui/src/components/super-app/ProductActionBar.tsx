import { BORDER, G0, G2, G3, NAVY_BASE, NAVY_CARD } from '../../tokens/colors';

import { SuperAppBottomNav, type SuperAppNavTab } from './BottomNav';
import { useSuperAppFonts } from './fonts';
import { SuperAppQuantityStepper } from './QuantityStepper';

/**
 * Sticky bottom action bar (qty stepper + Add to Cart), ported from the
 * "Sticky Bottom Bar" in the locked Figma Make Product Detail screen. The
 * source also renders a "Buy Now" button, but there is no real backend
 * flow for a direct express-checkout purchase today — `onBuyNow` is
 * therefore optional and the button only renders when a caller actually
 * wires one up, rather than shipping a button that does nothing.
 *
 * The source fuses this bar with the bottom tab bar into one shared
 * bottom-anchored footer (both stacked inside a single `absolute
 * bottom-0` wrapper) rather than two independently-positioned overlays —
 * passing `navTab` reproduces that by rendering `SuperAppBottomNav`
 * in-flow beneath the button row (`fixed={false}`).
 */
export function SuperAppProductActionBar({
  quantity,
  onDecrement,
  onIncrement,
  totalPriceLabel,
  outOfStock = false,
  onAddToCart,
  onBuyNow,
  navTab,
  onNavigate,
}: {
  quantity: number;
  onDecrement?: (() => void) | undefined;
  onIncrement?: (() => void) | undefined;
  totalPriceLabel: string;
  outOfStock?: boolean | undefined;
  onAddToCart?: (() => void) | undefined;
  onBuyNow?: (() => void) | undefined;
  navTab?: SuperAppNavTab | undefined;
  onNavigate?: ((tab: SuperAppNavTab) => void) | undefined;
}): React.JSX.Element {
  const { heading } = useSuperAppFonts();
  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-30"
      style={{ background: `linear-gradient(to top,${NAVY_BASE} 75%,transparent)` }}
    >
      <div className="flex items-center gap-3 px-5 pb-3 pt-3">
        <div
          className="flex h-[50px] shrink-0 items-center gap-3 rounded-2xl px-3"
          style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
        >
          <SuperAppQuantityStepper
            quantity={quantity}
            onDecrement={onDecrement}
            onIncrement={onIncrement}
            size="compact"
          />
        </div>

        <button
          type="button"
          onClick={onAddToCart}
          disabled={outOfStock}
          className={`flex h-[50px] flex-1 items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold text-white transition-all active:scale-[.97] ${heading}`}
          style={{
            background: outOfStock
              ? 'rgba(255,255,255,.06)'
              : `linear-gradient(135deg,${G0},${G2} 55%,${G3})`,
            boxShadow: outOfStock ? 'none' : '0 10px 32px rgba(43,172,82,.36)',
            color: outOfStock ? 'rgba(255,255,255,.22)' : 'white',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
          {outOfStock ? 'Out of Stock' : `Add · ${totalPriceLabel}`}
        </button>

        {!outOfStock && onBuyNow ? (
          <button
            type="button"
            onClick={onBuyNow}
            className={`h-[50px] rounded-2xl px-4 text-[13px] font-semibold transition-all active:scale-[.97] ${heading}`}
            style={{
              background: 'rgba(255,255,255,.07)',
              border: `1.5px solid ${BORDER}`,
              color: 'rgba(255,255,255,.7)',
            }}
          >
            Buy Now
          </button>
        ) : null}
      </div>
      {navTab ? <SuperAppBottomNav active={navTab} onNavigate={onNavigate} fixed={false} /> : null}
    </div>
  );
}
