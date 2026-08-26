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

import { detectNativePlatform, obtainNativeToken } from '@dripplex/hooks/notifications/native-push';

import { api } from './api';
import { auth } from './auth';

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

export interface PushRegistrationResult {
  /** Why nothing happened, when nothing happened — for logging and tests, not
   * for the UI. A person who declines notifications should not be nagged. */
  outcome: 'registered' | 'not-native' | 'not-signed-in' | 'no-token' | 'already' | 'failed';
  deviceId?: string;
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
    return { outcome: 'already' };
  }
  if (!auth.isLoggedIn()) {
    return { outcome: 'not-signed-in' };
  }

  const userId = auth.getUser()?.id;
  if (!userId) {
    return { outcome: 'not-signed-in' };
  }

  const stored = readStored();
  if (stored && stored.userId === userId) {
    return { outcome: 'already', deviceId: stored.id };
  }

  inFlight = true;
  try {
    const platform = await detectNativePlatform();
    if (!platform) {
      // Plain browser. Web push needs the Firebase JS SDK and a VAPID key,
      // which this app does not carry — customer-web is where that lives.
      return { outcome: 'not-native' };
    }

    // A different account was registered on this handset. Release that row
    // before claiming a new one, or its owner keeps receiving this device's
    // notifications.
    if (stored && stored.userId !== userId) {
      await api.devices.deactivate(stored.id).catch(() => undefined);
      clearStored();
    }

    const token = await obtainNativeToken();
    if (!token) {
      // Permission denied, registration error, or the 15s timeout. All three
      // are silent by design.
      return { outcome: 'no-token' };
    }

    const device = await api.devices.register({ platform, token });
    writeStored(device.id, userId);
    return { outcome: 'registered', deviceId: device.id };
  } catch {
    return { outcome: 'failed' };
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
 */
export function signOutRequest(): Promise<unknown> {
  return deregisterPushDevice().then(() => api.auth.logout());
}

/** Test seam — resets the module-level guard between cases. */
export function __resetPushRegistrationForTests(): void {
  inFlight = false;
}
