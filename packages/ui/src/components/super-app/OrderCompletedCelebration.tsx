import { BORDER, G0, G2, G3, MUTED, NAVY_BASE, NAVY_DEEP } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

/**
 * Order-completed celebration state, ported from the Tracking screen's
 * `DeliveredScreen`. The source's per-frame emoji-confetti field is
 * dropped for a single CSS checkmark-draw animation — real visual
 * intent (checkmark, order number, real total) kept, decorative
 * animation complexity trimmed. "Rate" is dropped: no real order/rider
 * rating capability exists (Review is product-scoped, not order-scoped).
 * "Download Receipt" is dropped: no PDF generation exists anywhere in
 * the backend.
 */
export function SuperAppOrderCompletedCelebration({
  orderNumber,
  onReorder,
  onViewOrders,
  onHome,
  onReportIssue,
}: {
  orderNumber: string;
  onReorder?: (() => void) | undefined;
  onViewOrders?: (() => void) | undefined;
  onHome?: (() => void) | undefined;
  /** Only pass this while the order is still DELIVERED (not COMPLETED) —
   * the real backend only allows raising a dispute in that window. */
  onReportIssue?: (() => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
      style={{
        background: `linear-gradient(155deg,${NAVY_DEEP} 0%,${NAVY_BASE} 60%,#0B1D2F 100%)`,
      }}
    >
      <div
        className="relative mb-6 flex items-center justify-center"
        style={{
          width: 128,
          height: 128,
          animation: 'success-bounce .7s cubic-bezier(.34,1.56,.64,1) .15s both',
        }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{ border: `2px solid ${G2}`, animation: 'pulse-ring 1.5s ease-out .7s infinite' }}
        />
        <svg width="128" height="128" viewBox="0 0 128 128" fill="none" className="absolute">
          <circle
            cx="64"
            cy="64"
            r="58"
            stroke="url(#dg)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="364"
            strokeDashoffset="364"
            style={{ animation: 'circle-draw .7s ease .25s both' }}
          />
          <defs>
            <linearGradient id="dg" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
              <stop stopColor={G0} />
              <stop offset="1" stopColor={G3} />
            </linearGradient>
          </defs>
        </svg>
        <svg width="52" height="52" viewBox="0 0 52 52" fill="none" className="absolute">
          <path
            d="M10 26l14 14 20-20"
            stroke="white"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="68"
            strokeDashoffset="68"
            style={{ animation: 'check-draw .45s ease .8s both' }}
          />
        </svg>
      </div>

      <div className="mb-6 flex flex-col items-center gap-2 px-8 text-center">
        <h2
          className={`text-[28px] font-bold text-white ${heading}`}
          style={{ letterSpacing: '-0.025em' }}
        >
          Delivered!
        </h2>
        <p className={`text-[14px] ${body}`} style={{ color: MUTED }}>
          Your order has arrived. Enjoy your meal!
        </p>
        <div
          className="mt-2 flex items-center gap-2 rounded-2xl px-4 py-2"
          style={{ background: 'rgba(43,172,82,.12)', border: '1px solid rgba(43,172,82,.25)' }}
        >
          <span className={`text-[13px] ${body}`} style={{ color: MUTED }}>
            Order <span className="font-bold text-white">#{orderNumber}</span>
          </span>
        </div>
      </div>

      <div className="flex w-full flex-col gap-3 px-7">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onReorder}
            className={`flex h-[50px] flex-1 items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold text-white transition-all active:scale-[.97] ${heading}`}
            style={{
              background: `linear-gradient(135deg,${G0},${G2} 55%,${G3})`,
              boxShadow: '0 10px 32px rgba(43,172,82,.36)',
            }}
          >
            🔄 Reorder
          </button>
          <button
            type="button"
            onClick={onViewOrders}
            className={`h-[50px] flex-1 rounded-2xl text-[14px] font-semibold transition-all active:scale-[.97] ${heading}`}
            style={{
              background: 'rgba(255,255,255,.07)',
              border: `1.5px solid ${BORDER}`,
              color: 'rgba(255,255,255,.75)',
            }}
          >
            📄 View Orders
          </button>
        </div>
        <button
          type="button"
          onClick={onHome}
          className={`w-full py-2 text-[13px] font-medium transition-opacity active:opacity-60 ${body}`}
          style={{ color: MUTED }}
        >
          Continue Shopping
        </button>
        {onReportIssue ? (
          <button
            type="button"
            onClick={onReportIssue}
            className={`w-full py-1 text-[12px] font-medium transition-opacity active:opacity-60 ${body}`}
            style={{ color: '#FCD34D' }}
          >
            ⚠️ Report an Issue
          </button>
        ) : null}
      </div>
    </div>
  );
}
