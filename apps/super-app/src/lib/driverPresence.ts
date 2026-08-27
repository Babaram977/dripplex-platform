/**
 * DPX-MOBILE-003 — driver presence, wired to this app's auth and API origin.
 *
 * The platform call lives in `@dripplex/hooks/driver/native-presence`, which is
 * where the Capacitor dependency belongs (the same split `push.ts` uses for the
 * ride-alert channel). This module's whole job is to supply the two things that
 * module deliberately does not know: where the API is, and who the driver is.
 *
 * The WebView heartbeat in `useDriverLocationPing` is NOT removed. It stays as
 * the foreground path and as the only path on iOS and on the web. Both writing
 * the same coordinates is harmless — the gateway throttles to one write per
 * driver per five seconds, and the REST write echoes the driver's own
 * availability back unchanged, so a heartbeat can never flip their settings.
 */
import {
  hasOverlayPermission,
  isNativeDriverPresenceRunning,
  requestOverlayPermission,
  startNativeDriverPresence,
  stopNativeDriverPresence,
  updateNativePresenceToken,
  type NativePresenceOutcome,
} from '@dripplex/hooks/driver/native-presence';

import { BASE } from './api';
import { auth } from './auth';

export type PresenceOutcome = NativePresenceOutcome | 'not-signed-in';

/** Start native reporting for a driver who has just gone online. Must be called
 * with the app on screen: Android 12+ refuses a foreground service started from
 * the background. */
export async function startDriverPresence(options: {
  vehicleType: string;
  acceptingRides?: boolean;
  acceptingDeliveries?: boolean;
  /** The driver's position, from the `getCurrentPosition()` the caller just
   * made. Seeds the service's first report — see the note on
   * `NativePresenceOptions.latitude` for why the service cannot be relied on to
   * find one for itself. */
  latitude?: number;
  longitude?: number;
}): Promise<PresenceOutcome> {
  const token = auth.getAccessToken();
  if (!token) return 'not-signed-in';
  return await startNativeDriverPresence({ baseUrl: BASE, token, ...options });
}

export async function stopDriverPresence(): Promise<PresenceOutcome> {
  return await stopNativeDriverPresence();
}

/**
 * Hand the running service a fresh access token, from wherever this app
 * refreshes its own (see `performRefresh` in api.ts).
 *
 * Without it driver presence had a hard fifteen-minute ceiling: the service is
 * given a token at Go-online, holds no refresh token, and `JWT_ACCESS_TTL` is
 * 15m — so the availability write started returning 401 and the service stopped
 * itself, taking the notification and the bubble with it, in the middle of a
 * shift it was built to survive.
 */
export async function updateDriverPresenceToken(token: string): Promise<void> {
  await updateNativePresenceToken(token);
}

export async function isDriverPresenceRunning(): Promise<boolean> {
  return await isNativeDriverPresenceRunning();
}

/**
 * The floating bubble's permission (founder decision, 2026-08-27).
 *
 * Re-exported rather than re-implemented: the driver screen needs to know
 * whether to offer the prompt, and nothing about that decision depends on this
 * app's auth or API origin.
 *
 * The bubble is strictly additive. A driver who never grants it has a fully
 * working shift — the service, the reporting and the ongoing notification are
 * all unaffected — so nothing in the online path may block on it.
 */
export { hasOverlayPermission, requestOverlayPermission };
