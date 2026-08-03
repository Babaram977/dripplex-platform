import { G0, G2, G3, MUTED, NAVY_BASE } from '../../tokens/colors';

import { SuperAppBottomNav, type SuperAppNavTab } from './BottomNav';
import { useSuperAppFonts } from './fonts';

/**
 * Sticky "Place Order" bar with a loading state, ported from the
 * Checkout screen's sticky footer. Fuses with the bottom tab bar the
 * same way `SuperAppProductActionBar`/`SuperAppCartCheckoutBar` do.
 */
export function SuperAppPlaceOrderBar({
  totalLabel,
  disabled = false,
  placing = false,
  onPlaceOrder,
  navTab,
  onNavigate,
}: {
  totalLabel: string;
  disabled?: boolean | undefined;
  placing?: boolean | undefined;
  onPlaceOrder?: (() => void) | undefined;
  navTab?: SuperAppNavTab | undefined;
  onNavigate?: ((tab: SuperAppNavTab) => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  const isDisabled = disabled || placing;
  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-30"
      style={{ background: `linear-gradient(to top,${NAVY_BASE} 80%,transparent)` }}
    >
      <div className="flex items-center gap-3 px-5 pb-2 pt-2">
        <div className="flex shrink-0 flex-col">
          <span className={`text-[11px] ${body}`} style={{ color: MUTED }}>
            Final Total
          </span>
          <span className={`text-[18px] font-bold text-white ${heading}`}>{totalLabel}</span>
        </div>
        <button
          type="button"
          onClick={isDisabled ? undefined : onPlaceOrder}
          disabled={isDisabled}
          className={`flex h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold transition-all active:scale-[.97] ${heading}`}
          style={{
            background: isDisabled
              ? 'rgba(255,255,255,.07)'
              : `linear-gradient(135deg,${G0},${G2} 55%,${G3})`,
            boxShadow: isDisabled ? 'none' : '0 10px 32px rgba(43,172,82,.36)',
            color: isDisabled ? 'rgba(255,255,255,.25)' : 'white',
          }}
        >
          {placing ? 'Placing Order…' : `Place Order · ${totalLabel}`}
        </button>
      </div>
      {navTab ? <SuperAppBottomNav active={navTab} onNavigate={onNavigate} fixed={false} /> : null}
    </div>
  );
}
