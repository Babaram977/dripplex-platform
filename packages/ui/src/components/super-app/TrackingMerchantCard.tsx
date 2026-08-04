import { BORDER, MUTED, NAVY_CARD } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

/**
 * Merchant summary row on the Tracking screen. "Store" links to the real
 * store page; "Call" is shown disabled (same no-telephony-yet reasoning
 * as `SuperAppTrackingRiderCard`) rather than omitted, since the source
 * shows both actions side by side.
 */
export function SuperAppTrackingMerchantCard({
  merchantName,
  onViewStore,
}: {
  merchantName: string;
  onViewStore?: (() => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
          style={{ background: 'linear-gradient(135deg,#7C2D12,#F97316)' }}
        >
          🏪
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[14px] font-semibold text-white ${heading}`}>
            {merchantName}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled
            className={`h-8 cursor-not-allowed rounded-xl px-3 text-[11px] font-semibold ${body}`}
            style={{
              background: 'rgba(255,255,255,.06)',
              border: `1px solid ${BORDER}`,
              color: MUTED,
            }}
          >
            📞
          </button>
          <button
            type="button"
            onClick={onViewStore}
            className={`h-8 rounded-xl px-3 text-[11px] font-semibold transition-all active:scale-95 ${body}`}
            style={{
              background: 'rgba(255,255,255,.06)',
              border: `1px solid ${BORDER}`,
              color: MUTED,
            }}
          >
            🏪
          </button>
        </div>
      </div>
    </div>
  );
}
