import { G0, G2, G3, MUTED, NAVY_BASE } from '../../tokens/colors';

import { SuperAppBottomNav, type SuperAppNavTab } from './BottomNav';
import { useSuperAppFonts } from './fonts';

/**
 * Sticky bottom bar (grand total + "Proceed to Checkout"), ported from
 * the Cart screen's sticky footer. Fuses with the bottom tab bar the same
 * way `SuperAppProductActionBar` does — see that component's doc comment.
 */
export function SuperAppCartCheckoutBar({
  grandTotalLabel,
  onCheckout,
  navTab,
  onNavigate,
}: {
  grandTotalLabel: string;
  onCheckout?: (() => void) | undefined;
  navTab?: SuperAppNavTab | undefined;
  onNavigate?: ((tab: SuperAppNavTab) => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-30"
      style={{ background: `linear-gradient(to top,${NAVY_BASE} 80%,transparent)` }}
    >
      <div className="flex items-center gap-3 px-5 pb-2 pt-2">
        <div className="flex flex-col">
          <span className={`text-[11px] ${body}`} style={{ color: MUTED }}>
            Grand Total
          </span>
          <span className={`text-[18px] font-bold text-white ${heading}`}>{grandTotalLabel}</span>
        </div>
        <button
          type="button"
          onClick={onCheckout}
          className={`flex h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-white transition-all active:scale-[.97] ${heading}`}
          style={{
            background: `linear-gradient(135deg,${G0},${G2} 55%,${G3})`,
            boxShadow: '0 10px 32px rgba(43,172,82,.36)',
          }}
        >
          Proceed to Checkout
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      {navTab ? <SuperAppBottomNav active={navTab} onNavigate={onNavigate} fixed={false} /> : null}
    </div>
  );
}
