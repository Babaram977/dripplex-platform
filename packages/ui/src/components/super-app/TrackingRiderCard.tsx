import { BORDER, G2, G3, MUTED, NAVY_CARD } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

/**
 * Assigned-rider card, ported from the Tracking screen's `DriverCard`.
 * The real `RiderProfile`/`User` models have no rating, delivery count,
 * vehicle model, or plate number — those are dropped rather than faked.
 * Call/Message follow the same pattern already established on the Ride
 * module's driver-assigned screens: shown but disabled, with an honest
 * note, since no telephony/chat capability exists yet.
 */
export function SuperAppTrackingRiderCard({
  name,
  live,
}: {
  name: string;
  live: boolean;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
    >
      <div className="mb-3 flex items-center gap-3">
        <div className="relative">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl"
            style={{
              background: 'linear-gradient(135deg,#1D4ED8,#7C3AED)',
              border: '2px solid rgba(255,255,255,.1)',
            }}
          >
            🛵
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[15px] font-semibold text-white ${heading}`}>{name}</p>
          <p className={`mt-0.5 text-[11px] ${body}`} style={{ color: MUTED }}>
            Your delivery rider
          </p>
        </div>
        {live ? (
          <div className="flex shrink-0 flex-col items-center gap-1">
            <div
              className="h-2 w-2 rounded-full"
              style={{ background: G3, boxShadow: `0 0 8px ${G3}` }}
            />
            <span className={`text-[10px] font-semibold ${body}`} style={{ color: G3 }}>
              LIVE
            </span>
          </div>
        ) : null}
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          disabled
          className={`flex h-[44px] flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-xl text-[13px] font-semibold ${heading}`}
          style={{
            background: 'rgba(255,255,255,.05)',
            border: `1.5px solid ${BORDER}`,
            color: MUTED,
          }}
        >
          📞 Call
        </button>
        <button
          type="button"
          disabled
          className={`flex h-[44px] flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-xl text-[13px] font-semibold ${heading}`}
          style={{
            background: 'rgba(255,255,255,.05)',
            border: `1.5px solid ${BORDER}`,
            color: MUTED,
          }}
        >
          💬 Message
        </button>
      </div>
      <p className={`mt-2 text-[10px] leading-relaxed ${body}`} style={{ color: MUTED }}>
        Calling and messaging aren&apos;t available yet — no telephony/chat capability.
      </p>
      <p
        className={`mt-2 text-[10px] leading-relaxed ${body}`}
        style={{ color: 'rgba(255,255,255,.22)' }}
      >
        <span style={{ color: G2 }}>Note:</span> rating and vehicle details aren&apos;t tracked for
        delivery riders yet.
      </p>
    </div>
  );
}
