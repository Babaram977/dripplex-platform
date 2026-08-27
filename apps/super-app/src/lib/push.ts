// ─── DrippleX push registration (DPX-MOBILE-001) ─────────────────────────────
//
// The APK is a Capacitor shell that loads this app from app.dripplex.com. Until
// now nothing in it ever asked for a push token, so a driver's phone could not
// be reached at all when the app was not on screen — the failure drivers
// reported as "the app dies when I leave it".
//
// `docs/mobile/PUSH-NOTIFICATIONS.md` recorded native token registration as
// done, and it is — in `apps/customer-web`, which is a different application on
// a different domain and is not what ships in the APK. This is that same work,
// for the app that actually runs on the device.
//
// The token acquisition itself is imported from `@dripplex/hooks` rather than
// rewritten: the permission prompt, the registration/registrationError
// listeners and the timeout are fiddly, and two copies would drift. Only the
// pure native-push submodule is imported, not the package index, so this app
// does not take on `@dripplex/sdk` — it deliberately keeps its own API client.
//
// Everything here is a no-op in a plain browser. `detectNativePlatform()`
// returns null off-device, and every entry point below returns early.

import {
  createNativeNotificationChannel,
  detectNativePlatform,
  listenForNativeNotificationTaps,
  obtainNativeTokenDetailed,
} from '@dripplex/hooks/notifications/native-push';
import { CALL_ALERT_ANDROID_CHANNEL_ID, RIDE_ALERT_ANDROID_CHANNEL_ID } from '@dripplex/types';

import { api } from './api';
import { announceIncomingCall, incomingCallFromDeepLink } from './callRequests';
import { stopDriverPresence } from './driverPresence';
import { auth } from './auth';

import type {
  CreateChannelOutcome,
  NativeNotificationChannel,
} from '@dripplex/hooks/notifications/native-push';

/**
 * DPX-MOBILE-001 — the channel a ride offer rings on.
 *
 * `importance: 5` (IMPORTANCE_HIGH) is what earns the heads-up banner and the
 * sound; at 3, the default, the notification appears silently in the shade and a
 * driver with the phone in their pocket learns about the offer after it has
 * rotated to someone else. Reserved for this one channel — an app that shouts
 * about everything gets turned off entirely.
 *
 * `vibration: true` because the plugin defaults it to **false**, so a channel
 * created without it is silent in the pocket even at maximum importance. It is
 * also the half of the alert that survives a phone on silent.
 *
 * `visibility: 1` (public) puts the pickup on the lock screen, which is where a
 * driver actually reads it — they are not unlocking the phone to decide whether a
 * job is worth taking. Nothing sensitive is in a ride offer's title or body.
 *
 * No `sound` filename: the app ships no audio in `res/raw`, and Android gives a
 * channel the **system default notification sound** when none is named. A
 * distinctive DrippleX ride tone is a real improvement over that and a real
 * decision — an asset to choose, licence and ship — so it is recorded as a gap in
 * `docs/mobile/PUSH-NOTIFICATIONS.md` rather than invented here.
 */
export const RIDE_ALERT_CHANNEL: NativeNotificationChannel = {
  id: RIDE_ALERT_ANDROID_CHANNEL_ID,
  name: 'Ride requests',
  description: 'Incoming trip offers. These expire in seconds, so they are loud.',
  importance: 5,
  visibility: 1,
  vibration: true,
  lights: true,
};

/**
 * Create the ride-alert channel if this device does not already have it.
 *
 * Called at app start rather than at sign-in, and deliberately not folded into
 * `registerPushDevice`: that function returns early for an account already
 * registered on this handset, so a driver **updating** from the build that
 * shipped registration without a channel would never reach it. Their token is
 * already on file, the server would start naming a channel their phone has never
 * created, and FCM would quietly deliver every ride offer to its fallback channel
 * instead.
 *
 * Running it at start also gets the ordering right for free: the channel exists
 * before any token this session could hand to the server, so there is no window
 * in which the backend can address a channel that is not there yet.
 */
export function ensureRideAlertChannel(): Promise<CreateChannelOutcome> {
  return createNativeNotificationChannel(RIDE_ALERT_CHANNEL);
}

/**
 * DPX-MOBILE-002 — the channel an incoming voice call rings on.
 *
 * Deliberately a separate channel from the ride alert rather than a second use
 * of it. A channel is the unit a person silences in Android's own settings: one
 * shared channel would mean a driver turning ride requests down between shifts
 * also stops hearing the passenger phoning them mid-trip.
 *
 * Same settings as the ride alert, for the same reasons — importance 5 to earn
 * the heads-up banner and a sound, `vibration: true` because the plugin
 * defaults it to false, `visibility: 1` because "who is calling" is what you
 * read on the lock screen before deciding to pick up, and no `sound` filename
 * so Android uses the system default until a DrippleX tone is chosen, licensed
 * and shipped.
 *
 * It is worth being explicit that this is a *notification*, not a ringtone: it
 * rings once per push, and stops. A call that rings continuously the way a
 * phone call does needs CallStyle and ConnectionService — recorded in
 * DPX-MOBILE-002 §8, not attempted here.
 */
export const CALL_ALERT_CHANNEL: NativeNotificationChannel = {
  id: CALL_ALERT_ANDROID_CHANNEL_ID,
  name: 'Incoming calls',
  description: 'Someone on your trip or delivery is calling you. These ring for under a minute.',
  importance: 5,
  visibility: 1,
  vibration: true,
  lights: true,
};

/**
 * Create the call-alert channel if this device does not already have it.
 *
 * Same reasoning as `ensureRideAlertChannel`, and the same ordering
 * requirement: the backend names this channel on every ring, and FCM quietly
 * delivers to its own silent fallback for a channel the app has not created —
 * which would look exactly like the bug this fixes.
 */
export function ensureCallAlertChannel(): Promise<CreateChannelOutcome> {
  return createNativeNotificationChannel(CALL_ALERT_CHANNEL);
}

/** Survives a reload so logout can deactivate the row it created, and so a
 * second registration for the same session is skipped. */
const DEVICE_ID_KEY = 'dx_push_device_id';

/** Which account the stored device id belongs to. Without this, signing in as a
 * different person on the same handset would deactivate a row that is no longer
 * yours to deactivate — or worse, leave the previous account's token live and
 * still receiving this device's notifications. */
const DEVICE_USER_KEY = 'dx_push_device_user';

function readStored(): { id: string; userId: string } | null {
  try {
    const id = localStorage.getItem(DEVICE_ID_KEY);
    const userId = localStorage.getItem(DEVICE_USER_KEY);
    return id && userId ? { id, userId } : null;
  } catch {
    // Private mode, or storage disabled. Registration still works; only the
    // ability to clean up on logout is lost.
    return null;
  }
}

function writeStored(id: string, userId: string): void {
  try {
    localStorage.setItem(DEVICE_ID_KEY, id);
    localStorage.setItem(DEVICE_USER_KEY, userId);
  } catch {
    /* see readStored */
  }
}

function clearStored(): void {
  try {
    localStorage.removeItem(DEVICE_ID_KEY);
    localStorage.removeItem(DEVICE_USER_KEY);
  } catch {
    /* see readStored */
  }
}

/** One registration at a time. Two screens mounting the effect, or a rapid
 * sign-out and back in, would otherwise race two prompts and two POSTs. */
let inFlight = false;

/** Whether the stored device id has been checked against the server this
 * session. Registration is called on every screen change, and one confirmation
 * is enough — without this the check would be a request per navigation. */
let verifiedThisSession = false;

export type PushRegistrationOutcome =
  | 'registered'
  | 'not-native'
  | 'not-signed-in'
  | 'permission-denied'
  | 'registration-error'
  | 'timeout'
  | 'already'
  | 'failed';

export interface PushRegistrationResult {
  outcome: PushRegistrationOutcome;
  deviceId?: string;
}

/**
 * The last thing registration did on this device, and whether a driver can
 * actually be reached.
 *
 * This exists because of a field test on 2026-08-27. A driver's phone never
 * registered a push token; the server had no device row, so
 * `FirebasePushProvider` returned success and sent nothing; and every one of
 * the six ways `registerPushDevice` can give up returned silently. Nobody —
 * driver, founder or engineer — could see which had happened, and the ride
 * offer sat pending on a phone that never rang.
 *
 * The original silence was deliberate and half right: somebody who declines
 * notifications should not be nagged. But "you chose this" and "this is
 * broken" are different facts, and collapsing them cost a day. A driver who is
 * online and unreachable is entitled to know.
 */
let lastResult: PushRegistrationResult | null = null;

const resultListeners = new Set<(result: PushRegistrationResult) => void>();

function publishResult(result: PushRegistrationResult): PushRegistrationResult {
  lastResult = result;
  for (const listener of [...resultListeners]) listener(result);
  return result;
}

/** What registration last did, or null before it has run this session. */
export function lastPushRegistration(): PushRegistrationResult | null {
  return lastResult;
}

export function onPushRegistrationChange(
  listener: (result: PushRegistrationResult) => void,
): () => void {
  resultListeners.add(listener);
  return () => {
    resultListeners.delete(listener);
  };
}

/**
 * Whether this outcome means the person is reachable when the app is shut.
 *
 * `not-native` counts as reachable-enough: a browser has no push and nothing is
 * wrong with the account, so telling a desktop user their alerts are broken
 * would be false.
 */
export function pushOutcomeIsHealthy(outcome: PushRegistrationOutcome): boolean {
  return outcome === 'registered' || outcome === 'already' || outcome === 'not-native';
}

/** One line a driver can act on. Null when there is nothing wrong to say. */
export function pushOutcomeMessage(outcome: PushRegistrationOutcome): string | null {
  switch (outcome) {
    case 'permission-denied':
      return 'Notifications are switched off for DrippleX. Turn them on in Settings or you will not hear new trips.';
    case 'registration-error':
      return 'This phone could not register for alerts. Check your connection and Google Play services, then retry.';
    case 'timeout':
      return 'Registering for alerts timed out. Check your connection and retry.';
    case 'not-signed-in':
      return 'Sign in again to receive trip alerts.';
    case 'failed':
      return 'Could not set up trip alerts on this phone. Retry, or sign out and back in.';
    default:
      return null;
  }
}

/**
 * Force a fresh registration attempt, ignoring the "already done" shortcut.
 *
 * The shortcut is keyed on localStorage, so a device whose server-side row was
 * removed — or which never had one because an earlier attempt failed silently
 * — would otherwise never try again for the life of the install.
 */
export async function retryPushRegistration(): Promise<PushRegistrationResult> {
  verifiedThisSession = false;
  clearStored();
  return await registerPushDevice();
}

/**
 * Acquire this device's FCM/APNs token and register it against the signed-in
 * account.
 *
 * Called after sign-in rather than at launch, which is both the platform
 * convention and the only point where the token has an account to attach to.
 * On Android 13+ the OS permission dialog appears here — the app has just been
 * signed into, so the prompt arrives in a context the person understands,
 * rather than cold on first open.
 *
 * Never throws. A device that cannot register is a device that does not get
 * push; it is not a reason to interrupt someone trying to work.
 */
export async function registerPushDevice(): Promise<PushRegistrationResult> {
  if (inFlight) {
    // Not published: a concurrent call is not an outcome, and overwriting the
    // real one with it would hide whatever the in-flight attempt concludes.
    return { outcome: 'already' };
  }
  if (!auth.isLoggedIn()) {
    return publishResult({ outcome: 'not-signed-in' });
  }

  const userId = auth.getUser()?.id;
  if (!userId) {
    return publishResult({ outcome: 'not-signed-in' });
  }

  const stored = readStored();
  if (stored && stored.userId === userId) {
    // Trust it once, then check it. localStorage saying "registered" is not
    // the same as the server holding a row: an earlier attempt could have
    // written the id and had the row deactivated since, and on 2026-08-27 a
    // driver sat online and unreachable for exactly that class of reason. The
    // shortcut is what makes this function cheap to call on every screen
    // change, so the verification runs once per session rather than per call.
    if (verifiedThisSession) {
      return publishResult({ outcome: 'already', deviceId: stored.id });
    }
    const live = await api.devices
      .list()
      .catch(() => null as Awaited<ReturnType<typeof api.devices.list>> | null);
    if (live === null) {
      // Offline, or the endpoint is unhappy. Not evidence of anything — assume
      // the stored id is good rather than tearing down a working registration.
      return publishResult({ outcome: 'already', deviceId: stored.id });
    }
    if (live.some((device) => device.id === stored.id)) {
      verifiedThisSession = true;
      return publishResult({ outcome: 'already', deviceId: stored.id });
    }
    // The row is gone. Fall through and register again rather than believing
    // localStorage for the life of the install.
    clearStored();
  }

  inFlight = true;
  try {
    const platform = await detectNativePlatform();
    if (!platform) {
      // Plain browser. Web push needs the Firebase JS SDK and a VAPID key,
      // which this app does not carry — customer-web is where that lives.
      return publishResult({ outcome: 'not-native' });
    }

    // A different account was registered on this handset. Release that row
    // before claiming a new one, or its owner keeps receiving this device's
    // notifications.
    if (stored && stored.userId !== userId) {
      await api.devices.deactivate(stored.id).catch(() => undefined);
      clearStored();
    }

    const { token, reason } = await obtainNativeTokenDetailed();
    if (!token) {
      // Each of these used to be the same silent `no-token`. They need
      // different things from the driver, so they are now different outcomes.
      return publishResult({ outcome: reason === 'granted' ? 'failed' : reason });
    }

    const device = await api.devices.register({ platform, token });
    writeStored(device.id, userId);
    return publishResult({ outcome: 'registered', deviceId: device.id });
  } catch {
    return publishResult({ outcome: 'failed' });
  } finally {
    inFlight = false;
  }
}

/**
 * Release this device's token on sign-out.
 *
 * Best-effort: an orphaned token self-heals server-side the next time FCM
 * reports it dead, so a failure here is not worth blocking sign-out over — and
 * `endSession` clears the local session regardless.
 *
 * Called before the tokens are cleared, since the request needs to authenticate.
 */
export async function deregisterPushDevice(): Promise<void> {
  verifiedThisSession = false;
  const stored = readStored();
  if (!stored) {
    return;
  }
  clearStored();
  await api.devices.deactivate(stored.id).catch(() => undefined);
}

/**
 * What every sign-out button should pass to `endSession`.
 *
 * Ordering is the point: the device row is released while the access token is
 * still valid, then the session is revoked. `endSession` clears local storage
 * afterwards either way, so a failure in either half still signs the person out.
 *
 * Exported as one function rather than composed at each of the four sign-out
 * call sites, so a fifth one cannot quietly forget the cleanup.
 *
 * DPX-MOBILE-003 joins the same ordering. The native presence service holds an
 * access token in memory and shows an ongoing "You are online" notification;
 * left running past sign-out it would keep reporting a driver who has left, on
 * a token they no longer own. Stopped first, and never allowed to fail the
 * sign-out: a driver who cannot sign out is worse than a service that lingers
 * until the process dies.
 */
export function signOutRequest(): Promise<unknown> {
  return stopDriverPresence()
    .catch(() => undefined)
    .then(() => deregisterPushDevice())
    .then(() => api.auth.logout());
}

/**
 * DPX-MOBILE-002 Stage 2 — act on a tapped notification.
 *
 * The only tap that does anything today is a call, and it has to: the ring is
 * how the callee learns the call exists at all, because `call:incoming` went
 * out over a socket their closed app was not connected to. Tapping it is
 * therefore not navigation, it is the answer screen appearing.
 *
 * A link for a call that has already stopped ringing is dropped by
 * `incomingCallFromDeepLink` rather than shown — a push can sit unnoticed on a
 * lock screen long after the caller gave up, and a ringing screen for a call
 * nobody is on is worse than no screen at all.
 *
 * Returns a teardown, or null off-device. Never throws.
 */
export async function listenForCallNotificationTaps(): Promise<(() => void) | null> {
  try {
    return await listenForNativeNotificationTaps(({ deepLink }) => {
      if (!deepLink) return;
      const announcement = incomingCallFromDeepLink(deepLink);
      if (announcement) announceIncomingCall(announcement);
    });
  } catch {
    // A listener that cannot be attached costs the tap-to-answer path. It must
    // not cost the app its start-up.
    return null;
  }
}

/** Test seam — resets the module-level guard and the recorded outcome. */
export function __resetPushRegistrationForTests(): void {
  inFlight = false;
  verifiedThisSession = false;
  lastResult = null;
  resultListeners.clear();
}
