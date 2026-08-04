import { useSuperAppFonts } from './fonts';

/**
 * Cancel Order / Report an Issue actions, ported from the Tracking
 * screen. Unlike the source (which always shows both), "Report an
 * Issue" only renders when a handler is passed — the real backend only
 * allows raising a dispute once an order is DELIVERED
 * (`CheckoutService.raiseDispute`: "Only delivered orders can be
 * disputed"), so it isn't a valid action at any earlier status.
 */
export function SuperAppTrackingActionBar({
  canCancel,
  onCancel,
  onReport,
}: {
  canCancel: boolean;
  onCancel?: (() => void) | undefined;
  onReport?: (() => void) | undefined;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <div className="flex flex-col gap-3">
      {canCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className={`flex h-[44px] w-full items-center justify-center gap-1.5 rounded-xl text-[12px] font-semibold transition-all active:scale-95 ${body}`}
          style={{
            background: 'rgba(248,113,113,.08)',
            border: '1px solid rgba(248,113,113,.22)',
            color: '#F87171',
          }}
        >
          ✕ Cancel Order
        </button>
      ) : null}
      {onReport ? (
        <button
          type="button"
          onClick={onReport}
          className={`flex h-[40px] w-full items-center justify-center gap-1.5 rounded-xl text-[12px] font-semibold transition-all active:scale-95 ${body}`}
          style={{
            background: 'rgba(251,191,36,.06)',
            border: '1px solid rgba(251,191,36,.18)',
            color: '#FCD34D',
          }}
        >
          ⚠️ Report an Issue
        </button>
      ) : null}
    </div>
  );
}
