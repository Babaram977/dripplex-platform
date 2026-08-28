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
    presencePath: string;
    presenceBody: Record<string, string | number | boolean>;
    onlineText?: string;
    intervalMs?: number;
    latitude?: number;
    longitude?: number;
  }): Promise<{ started: boolean }>;
  stop(): Promise<void>;
  updateToken(options: { token: string }): Promise<void>;
  isRunning(): Promise<{ running: boolean }>;
  hasOverlayPermission(): Promise<{ granted: boolean }>;
  requestOverlayPermission(): Promise<{ opened: boolean; granted: boolean }>;
}

/**
 * `no-plugin` is separate from `not-android` on purpose, and the separation is
 * the whole lesson of this module's first release.
 *
 * When the plugin could not be resolved, this reported `not-android` — on an
 * Android phone. Anyone reading it, including the person who wrote it,
 * concluded "expected, this is the web/iOS path" and stopped. `no-plugin` says
 * the thing that is actually wrong: this IS Android, and the native side is not
 * answering.
 */
export type NativePresenceOutcome =
  'started' | 'stopped' | 'not-android' | 'no-plugin' | 'unavailable' | 'failed';

export interface NativePresenceOptions {
  /** API origin the service posts availability to, e.g. the same base the web
   * client uses. Passed in so the two cannot drift. */
  baseUrl: string;
  /** Bearer token. Held in the service's memory only — never persisted. */
  token: string;
  /**
   * Which availability endpoint to post to, relative to `baseUrl` — e.g.
   * `/driver/rides/availability` or `/rider/availability`.
   *
   * The native service knows about neither persona. It was hardcoded to the
   * driver's path, which is why riders were left with the WebView heartbeat
   * that Chromium throttles and Android kills — the same failure DPX-MOBILE-003
   * removed for drivers. Passing the path and body from here means a third
   * persona is a web deploy rather than a new APK on every device.
   */
  presencePath: string;
  /**
   * The persona-specific half of the request body. The service merges a fresh
   * `latitude` and `longitude` into it on every report, so do not put a
   * position here — that is what the seed options below are for.
   */
  presenceBody: Record<string, string | number | boolean>;
  /** Notification text while reporting is healthy. A rider is not waiting for
   * ride requests, so the driver's wording would be wrong for them. */
  onlineText?: string;
  /**
   * The position the caller already holds, seeding the service's first report.
   *
   * Not a nicety — it is the fix for the 2026-08-27 field failure. The service
   * subscribes to the platform `LocationManager`, which on a modern handset can
   * hand back nothing at all: `NETWORK_PROVIDER` often does not exist (Google
   * moved coarse location into Play Services) and raw GPS gets no fix indoors.
   * It then ran for nine minutes posting nothing while its notification said
   * the driver was online, and the driver went stale to dispatch at five.
   *
   * The app has a real fix at this exact moment — `driverScreen` calls
   * `getCurrentPosition()` immediately before starting presence, through Play
   * Services via the WebView — so it hands it over rather than letting the
   * service start blind. A real fix from any provider replaces it at once.
   */
  latitude?: number;
  longitude?: number;
}

/**
 * The registered proxy, kept for the life of the page.
 *
 * `registerPlugin` refuses to register the same name twice — it logs
 * "Cannot register plugins twice" and hands back the existing proxy
 * (@capacitor/core 7.6.8, index.cjs.js:68-73). Harmless, but this module is
 * called on every shift start and stop, so caching keeps that warning out of
 * the console.
 */
let cached: DriverPresencePlugin | null = null;

type Resolved =
  { plugin: DriverPresencePlugin } | { plugin: null; reason: 'not-android' | 'no-plugin' };

/**
 * Resolves the plugin only on a Capacitor-native **Android** build.
 *
 * ## Why this goes through `registerPlugin` and not `Capacitor.Plugins`
 *
 * It used to read `Capacitor.Plugins['DriverPresence']`, which is **always
 * undefined**, and the whole feature was dead on device from the day it
 * shipped: no bubble, no ongoing notification, and — the part that matters —
 * no native heartbeat, so a minimised driver still went invisible to dispatch
 * after four minutes, which is the exact bug DPX-MOBILE-003 exists to fix.
 *
 * `Capacitor.Plugins` is written in exactly one place: `Plugins[pluginName] =
 * proxy` inside `registerPlugin` (@capacitor/core 7.6.8, index.cjs.js:178). The
 * Android bridge does not touch it — `JSExport.java:91` injects
 * `window.Capacitor.PluginHeaders` and nothing else. So a native plugin that
 * JavaScript never registers has no entry there, no matter how correct the Java
 * is. `@capacitor/push-notifications` works because the package calls
 * `registerPlugin` for itself; `DriverPresence` has no such package, so this is
 * the call.
 *
 * Nothing about that failure was visible: `startNativeDriverPresence` maps a
 * missing plugin to `'not-android'`, which on a real Android phone is a lie
 * that reads like a supported platform check.
 *
 * `isPluginAvailable` is then the real gate — it consults `PluginHeaders`, so it
 * answers "is the Java actually in this build", which the platform check alone
 * does not. Without it an APK built before the plugin existed would get a proxy
 * whose every method rejects.
 *
 * The platform narrowing stays: the plugin is registered in the Android app
 * module and does not exist on iOS, so calling it there rejects on every shift
 * start for a feature that was never built for that platform. A plain browser
 * has no Capacitor at all.
 */
async function resolvePlugin(): Promise<Resolved> {
  if (cached) return { plugin: cached };
  try {
    const { Capacitor, registerPlugin } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return { plugin: null, reason: 'not-android' };
    }
    if (!Capacitor.isPluginAvailable('DriverPresence')) {
      // The shell predates the plugin. Degrading to the WebView heartbeat beats
      // handing back a proxy whose every method rejects.
      return { plugin: null, reason: 'no-plugin' };
    }
    cached = registerPlugin<DriverPresencePlugin>('DriverPresence');
    return { plugin: cached };
  } catch {
    // @capacitor/core unresolvable — a portal that never ships as a shell.
    return { plugin: null, reason: 'not-android' };
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
  const resolved = await resolvePlugin();
  const plugin = resolved.plugin;
  if (!plugin) return resolved.reason;
  if (!options.token || !options.baseUrl || !options.presencePath) {
    // The service would show "You are online" while reporting nothing, which
    // is the exact failure this whole feature exists to remove.
    return 'unavailable';
  }
  try {
    await plugin.start({
      baseUrl: options.baseUrl,
      token: options.token,
      presencePath: options.presencePath,
      presenceBody: options.presenceBody,
      ...(options.onlineText !== undefined ? { onlineText: options.onlineText } : {}),
      // Both or neither: the native side needs the pair, and half a coordinate
      // would seed a position on the equator.
      ...(options.latitude !== undefined && options.longitude !== undefined
        ? { latitude: options.latitude, longitude: options.longitude }
        : {}),
    });
    return 'started';
  } catch {
    return 'failed';
  }
}

/**
 * Hand the running service a fresh access token.
 *
 * The service is given a token when the driver goes online and cannot renew it
 * on its own — it holds no refresh token, by design, and one should not be put
 * inside a background service. `JWT_ACCESS_TTL` is 15 minutes, so without this
 * the whole feature had a fifteen-minute ceiling: the token expired, the
 * availability write returned 401, and the service stopped itself. Observed on
 * 2026-08-27, when the bubble and the ongoing notification vanished mid-test
 * while the WebView — which refreshes normally — carried on reporting.
 *
 * Call it wherever the app refreshes its own token. A no-op off Android, with
 * no service running, or on any failure: a token update that fails must never
 * break the refresh that triggered it.
 */
export async function updateNativePresenceToken(token: string): Promise<void> {
  if (!token) return;
  const { plugin } = await resolvePlugin();
  if (!plugin) return;
  try {
    await plugin.updateToken({ token });
  } catch {
    // The service is not running, or the platform call failed. Either way the
    // next Go-online hands over a fresh token anyway.
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
  const resolved = await resolvePlugin();
  const plugin = resolved.plugin;
  if (!plugin) return resolved.reason;
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
  const { plugin } = await resolvePlugin();
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
  const { plugin } = await resolvePlugin();
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
  const { plugin } = await resolvePlugin();
  if (!plugin) return { opened: false, granted: false };
  try {
    return await plugin.requestOverlayPermission();
  } catch {
    // Some OEM builds ship no such Settings screen. Nothing is broken; the
    // driver just cannot have the bubble on that handset.
    return { opened: false, granted: false };
  }
}
