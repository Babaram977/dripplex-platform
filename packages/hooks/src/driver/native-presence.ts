/**
 * DPX-MOBILE-003 — the Android driver-presence foreground service, from
 * JavaScript.
 *
 * A driver who minimised DrippleX went invisible to dispatch roughly four
 * minutes later. The heartbeat is a `setInterval` inside the WebView, Android
 * freezes those when the app is backgrounded, and `findNearestEligibleDriver`
 * skips any driver whose `locationUpdatedAt` is older than five minutes — while
 * their row still says `online: true` and their screen still says "You are
 * live". They do not go offline; they go invisible.
 *
 * The native service reports on its own rather than waking the WebView to do
 * it, because a hidden WebView's timers are throttled whether or not a
 * foreground service is running — see DriverPresenceService.java.
 *
 * This module owns only the platform call. It takes the API origin and access
 * token as arguments and knows nothing about how the app stores either, the
 * same separation `native-push.ts` keeps.
 */

/** What the native plugin exposes. Declared here rather than imported: the
 * plugin lives in the Android app module, so there is no package to import a
 * type from, and every call below goes through this shape. */
interface DriverPresencePlugin {
  start(options: {
    baseUrl: string;
    token: string;
    vehicleType: string;
    acceptingRides?: boolean;
    acceptingDeliveries?: boolean;
    intervalMs?: number;
  }): Promise<{ started: boolean }>;
  stop(): Promise<void>;
  isRunning(): Promise<{ running: boolean }>;
  hasOverlayPermission(): Promise<{ granted: boolean }>;
  requestOverlayPermission(): Promise<{ opened: boolean; granted: boolean }>;
}

export type NativePresenceOutcome =
  'started' | 'stopped' | 'not-android' | 'unavailable' | 'failed';

export interface NativePresenceOptions {
  /** API origin the service posts availability to, e.g. the same base the web
   * client uses. Passed in so the two cannot drift. */
  baseUrl: string;
  /** Bearer token. Held in the service's memory only — never persisted. */
  token: string;
  vehicleType: string;
  acceptingRides?: boolean;
  acceptingDeliveries?: boolean;
}

/**
 * Resolves the plugin only on a Capacitor-native **Android** build.
 *
 * The platform narrowing matters: the plugin is registered in the Android app
 * module and does not exist on iOS, so calling it there rejects on every shift
 * start for a feature that was never built for that platform. A plain browser
 * has no Capacitor at all.
 */
async function resolvePlugin(): Promise<DriverPresencePlugin | null> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return null;
    }
    const plugins = (Capacitor as unknown as { Plugins?: Record<string, unknown> }).Plugins;
    return (plugins?.['DriverPresence'] as DriverPresencePlugin | undefined) ?? null;
  } catch {
    // @capacitor/core unresolvable — a portal that never ships as a shell.
    return null;
  }
}

/**
 * Start reporting natively.
 *
 * Call it while the app is on screen — from the driver tapping "Go online".
 * Android 12+ refuses to start a foreground service from the background, and
 * the plugin surfaces that refusal as a rejected promise rather than a crash.
 *
 * Never throws: presence failing is a degraded shift, not a broken app, and a
 * driver must not be blocked from going online because a platform call was
 * unavailable.
 */
export async function startNativeDriverPresence(
  options: NativePresenceOptions,
): Promise<NativePresenceOutcome> {
  const plugin = await resolvePlugin();
  if (!plugin) return 'not-android';
  if (!options.token || !options.baseUrl || !options.vehicleType) {
    // The service would show "You are online" while reporting nothing, which
    // is the exact failure this whole feature exists to remove.
    return 'unavailable';
  }
  try {
    await plugin.start({
      baseUrl: options.baseUrl,
      token: options.token,
      vehicleType: options.vehicleType,
      ...(options.acceptingRides !== undefined ? { acceptingRides: options.acceptingRides } : {}),
      ...(options.acceptingDeliveries !== undefined
        ? { acceptingDeliveries: options.acceptingDeliveries }
        : {}),
    });
    return 'started';
  } catch {
    return 'failed';
  }
}

/**
 * Stop reporting. Call on going offline and on sign-out.
 *
 * A presence notification that outlives the shift tells a driver they are
 * working when they are not, and leaves an access token alive in a service
 * nobody is watching.
 */
export async function stopNativeDriverPresence(): Promise<NativePresenceOutcome> {
  const plugin = await resolvePlugin();
  if (!plugin) return 'not-android';
  try {
    await plugin.stop();
    return 'stopped';
  } catch {
    return 'failed';
  }
}

/** Whether the service is currently running. False on every non-Android
 * platform, and on any failure — a caller must never conclude "running" from
 * an error. */
export async function isNativeDriverPresenceRunning(): Promise<boolean> {
  const plugin = await resolvePlugin();
  if (!plugin) return false;
  try {
    const { running } = await plugin.isRunning();
    return running;
  } catch {
    return false;
  }
}

/**
 * Whether the driver has granted "Display over other apps" — the floating
 * bubble (founder decision, 2026-08-27).
 *
 * SYSTEM_ALERT_WINDOW is a **special** permission: there is no runtime dialog,
 * so the app can only check it and send the driver to Settings. False on every
 * non-Android platform and on any failure, because a caller must never conclude
 * "granted" from an error and then promise a bubble that cannot appear.
 */
export async function hasOverlayPermission(): Promise<boolean> {
  const plugin = await resolvePlugin();
  if (!plugin) return false;
  try {
    const { granted } = await plugin.hasOverlayPermission();
    return granted;
  } catch {
    return false;
  }
}

/**
 * Send the driver to the Settings screen that grants it.
 *
 * Resolves as soon as Settings opens. It CANNOT report the outcome — the choice
 * is made in another app and the driver may simply walk back — so callers must
 * re-check `hasOverlayPermission()` on resume rather than assume success.
 *
 * `opened: false, granted: true` means it was already on and nothing was shown.
 */
export async function requestOverlayPermission(): Promise<{
  opened: boolean;
  granted: boolean;
}> {
  const plugin = await resolvePlugin();
  if (!plugin) return { opened: false, granted: false };
  try {
    return await plugin.requestOverlayPermission();
  } catch {
    // Some OEM builds ship no such Settings screen. Nothing is broken; the
    // driver just cannot have the bubble on that handset.
    return { opened: false, granted: false };
  }
}
