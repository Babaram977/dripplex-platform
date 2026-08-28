import { BORDER } from './shared';
import { COLOR_WARNING, TEXT_SECONDARY } from '../tokens/colors';

import type { PresenceOutcome } from '../lib/driverPresence';

const IT = "'Inter',sans-serif";

/**
 * DPX-MOBILE-003 — whether the shift is actually being held open natively, and
 * the one permission the driver has to grant by hand.
 *
 * Two separate things, deliberately in one place because they are one question
 * to a driver ("is my shift safe if I put the phone away?"), and because they
 * fail independently:
 *
 * - **The service did not start.** The WebView heartbeat is then the only path,
 *   Android freezes it a few minutes after the app leaves the screen, and the
 *   driver goes invisible to dispatch while their own screen still says "You
 *   are live". They are owed a warning; this is it.
 * - **The bubble is not permitted.** SYSTEM_ALERT_WINDOW has no runtime dialog,
 *   so an app that never offers this prompt can never get it granted — which is
 *   exactly why the floating icon did not appear on the first build that
 *   shipped the Java for it. Strictly an offer, never a warning: a driver who
 *   declines keeps a fully working shift and simply has no circle.
 *
 * Renders nothing on web and iOS, where 'not-android' is the correct and
 * expected answer rather than a fault.
 */
export function DriverPresenceStatus({
  outcome,
  overlayGranted,
  onRequestOverlay,
}: {
  outcome: PresenceOutcome | null;
  overlayGranted: boolean | null;
  onRequestOverlay: () => void;
}) {
  if (outcome === null || outcome === 'not-android' || outcome === 'stopped') return null;

  if (outcome !== 'started') {
    return (
      <div
        className="mt-2 flex flex-col items-center gap-1 rounded-xl px-3 py-2"
        style={{ background: 'rgba(245,158,11,.10)', border: `1px solid ${COLOR_WARNING}33` }}
      >
        <p className="text-center" style={{ fontFamily: IT, fontSize: 12, color: COLOR_WARNING }}>
          Keep DrippleX open. This phone stops showing you to dispatch a few minutes after you
          minimise the app.
        </p>
        <p style={{ fontFamily: IT, fontSize: 10, color: 'rgba(255,255,255,.35)' }}>
          presence: {outcome}
        </p>
      </div>
    );
  }

  if (overlayGranted !== false) return null;

  return (
    <div
      className="mt-2 flex flex-col items-center gap-2 rounded-xl px-3 py-2"
      style={{ background: 'rgba(255,255,255,.04)', border: `1px solid ${BORDER}` }}
    >
      <p className="text-center" style={{ fontFamily: IT, fontSize: 12, color: TEXT_SECONDARY }}>
        Show a floating DrippleX button over your other apps, so you can see you are online from
        anywhere.
      </p>
      <button
        onClick={onRequestOverlay}
        className="rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all active:scale-95"
        style={{
          background: 'rgba(255,255,255,.08)',
          border: `1px solid ${BORDER}`,
          color: '#FFF',
          fontFamily: IT,
        }}
      >
        Turn on
      </button>
    </div>
  );
}
