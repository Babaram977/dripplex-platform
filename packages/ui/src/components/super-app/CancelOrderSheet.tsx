import { BORDER, NAVY_CARD } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

/** Cancel-order confirmation sheet, ported from the Tracking screen. */
export function SuperAppCancelOrderSheet({
  submitting = false,
  onConfirm,
  onClose,
}: {
  submitting?: boolean | undefined;
  onConfirm?: (() => void) | undefined;
  onClose?: (() => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div
      className="absolute inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,.72)' }}
      onClick={onClose}
    >
      <div
        className="flex flex-col gap-4 rounded-t-[32px] p-6"
        style={{
          background: NAVY_CARD,
          border: `1px solid ${BORDER}`,
          animation: 'fade-up .25s ease both',
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div
          className="mx-auto h-1 w-10 rounded-full"
          style={{ background: 'rgba(255,255,255,.2)' }}
        />
        <div className="text-center">
          <span style={{ fontSize: 36 }}>⚠️</span>
          <p className={`mb-1 mt-2 text-[17px] font-bold text-white ${heading}`}>Cancel Order?</p>
          <p
            className={`text-[13px] leading-relaxed ${body}`}
            style={{ color: 'rgba(255,255,255,.6)' }}
          >
            This will cancel your order. If it was already paid, a refund will be issued to your
            wallet.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className={`h-[48px] flex-1 rounded-2xl text-[14px] font-medium ${body}`}
            style={{
              background: 'rgba(255,255,255,.06)',
              border: `1px solid ${BORDER}`,
              color: 'rgba(255,255,255,.6)',
            }}
          >
            Keep Order
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className={`h-[48px] flex-1 rounded-2xl text-[14px] font-bold ${heading}`}
            style={{
              background: 'rgba(248,113,113,.18)',
              border: '1px solid rgba(248,113,113,.3)',
              color: '#F87171',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? 'Cancelling…' : 'Cancel Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
