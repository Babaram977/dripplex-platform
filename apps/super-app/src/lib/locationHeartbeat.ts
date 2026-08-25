import { useEffect, useRef, useState } from 'react';

import { getCurrentPosition } from './maps';

/**
 * How often an online driver or rider re-reports where they are.
 *
 * The server treats a position older than five minutes as no position at all
 * — dispatch skips that driver entirely. Until now the apps sent a position
 * ONCE, when going online, and never again: five minutes later the driver was
 * invisible to dispatch while their app still said "You are live". That is
 * the shape of "Lawan is online but no order matches him".
 *
 * Two minutes leaves room for one whole tick to fail — a tunnel, a locked
 * screen, a slow fix — and still land inside the five-minute window.
 */
export const LOCATION_HEARTBEAT_MS = 2 * 60_000;

/**
 * The browser can stop answering after it has already said yes once: a
 * revoked permission, a device with location switched off, a fix that times
 * out indoors. When that happens the driver is heading for invisibility and
 * has no way to know, so the count is surfaced rather than swallowed.
 */
const FAILURES_BEFORE_WARNING = 2;

export interface LocationHeartbeat {
  /** True once we have stopped being able to get a position while online.
   *  The caller should say so — a green "You are live" that is about to stop
   *  being true is worse than an amber warning. */
  degraded: boolean;
  /** When a position was last successfully sent. */
  lastSentAt: Date | null;
}

/**
 * Keeps the server's idea of where somebody is from going stale while they
 * are online.
 *
 * Sends immediately on going online — so a driver is dispatchable the moment
 * they toggle on rather than two minutes later — and then on the interval
 * until they go offline or the component unmounts.
 *
 * `send` is held in a ref so a caller passing an inline arrow function does
 * not restart the timer on every render, which would either hammer the
 * endpoint or, with the dependency omitted, quietly send with stale state.
 */
export function useLocationHeartbeat(
  online: boolean,
  send: (position: { latitude: number; longitude: number }) => Promise<unknown>,
  /** Override the cadence. Two minutes is right for "stay dispatchable"; a
   *  driver already on a trip reports far more often, because the passenger is
   *  watching the car move and the start-ride gate measures the last fix. */
  intervalMs: number = LOCATION_HEARTBEAT_MS,
): LocationHeartbeat {
  const [degraded, setDegraded] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);
  const sendRef = useRef(send);
  sendRef.current = send;

  useEffect(() => {
    if (!online) {
      setDegraded(false);
      return;
    }

    let live = true;
    let consecutiveFailures = 0;

    const beat = async (): Promise<void> => {
      const position = await getCurrentPosition();
      if (!live) return;

      if (position === null) {
        consecutiveFailures += 1;
        if (consecutiveFailures >= FAILURES_BEFORE_WARNING) setDegraded(true);
        return;
      }

      try {
        await sendRef.current(position);
        if (!live) return;
        consecutiveFailures = 0;
        setDegraded(false);
        setLastSentAt(new Date());
      } catch {
        // A failed send is the same problem as a failed fix from the server's
        // point of view: the position it holds is ageing either way.
        consecutiveFailures += 1;
        if (!live) return;
        if (consecutiveFailures >= FAILURES_BEFORE_WARNING) setDegraded(true);
      }
    };

    void beat();
    const timer = setInterval(() => void beat(), intervalMs);

    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [online, intervalMs]);

  return { degraded, lastSentAt };
}
