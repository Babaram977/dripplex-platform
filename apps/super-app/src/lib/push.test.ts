import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mocked before the module under test is imported, so its top-level imports
// bind to these rather than the real Capacitor / API / auth modules.
const detectNativePlatform = vi.fn();
const obtainNativeTokenDetailed = vi.fn();
const createNativeNotificationChannel = vi.fn();
const deleteNativeNotificationChannel = vi.fn();
const listenForNativeNotificationTaps = vi.fn();
vi.mock('@dripplex/hooks/notifications/native-push', () => ({
  detectNativePlatform: () => detectNativePlatform(),
  obtainNativeTokenDetailed: () => obtainNativeTokenDetailed(),
  listenForNativeNotificationTaps: (cb: unknown) => listenForNativeNotificationTaps(cb),
  createNativeNotificationChannel: (channel: unknown) => createNativeNotificationChannel(channel),
  deleteNativeNotificationChannel: (id: unknown) => deleteNativeNotificationChannel(id),
}));

const stopPresence = vi.fn();
vi.mock('./driverPresence', () => ({
  stopDriverPresence: () => stopPresence(),
}));

const registerDevice = vi.fn();
const deactivateDevice = vi.fn();
const listDevices = vi.fn();
const logout = vi.fn();
vi.mock('./api', () => ({
  api: {
    devices: {
      register: (body: unknown) => registerDevice(body),
      deactivate: (id: string) => deactivateDevice(id),
      list: () => listDevices(),
    },
    auth: { logout: () => logout() },
  },
}));

let currentUser: { id: string } | null = { id: 'user-1' };
vi.mock('./auth', () => ({
  auth: {
    isLoggedIn: () => currentUser !== null,
    getUser: () => currentUser,
  },
}));

import { RIDE_ALERT_ANDROID_CHANNEL_ID, RIDE_ALERT_ANDROID_CHANNEL_ID_V1 } from '@dripplex/types';

import {
  __resetPushRegistrationForTests,
  deregisterPushDevice,
  ensureRideAlertChannel,
  lastPushRegistration,
  onPushRegistrationChange,
  pushOutcomeIsHealthy,
  pushOutcomeMessage,
  registerPushDevice,
  retryPushRegistration,
  RIDE_ALERT_CHANNEL,
  signOutRequest,
} from './push';

describe('push registration (DPX-MOBILE-001)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    __resetPushRegistrationForTests();
    currentUser = { id: 'user-1' };
    detectNativePlatform.mockResolvedValue('ANDROID');
    obtainNativeTokenDetailed.mockResolvedValue({ token: 'fcm-token-abc', reason: 'granted' });
    registerDevice.mockResolvedValue({ id: 'device-1' });
    listDevices.mockResolvedValue([{ id: 'device-1' }]);
    deactivateDevice.mockResolvedValue(undefined);
    logout.mockResolvedValue(undefined);
    stopPresence.mockResolvedValue('stopped');
  });

  it('registers the device token against the signed-in account', async () => {
    const result = await registerPushDevice();

    expect(result).toEqual({ outcome: 'registered', deviceId: 'device-1' });
    expect(registerDevice).toHaveBeenCalledWith({ platform: 'ANDROID', token: 'fcm-token-abc' });
  });

  it('does nothing in a plain browser — no prompt, no request', async () => {
    detectNativePlatform.mockResolvedValue(null);

    expect(await registerPushDevice()).toEqual({ outcome: 'not-native' });
    // The permission prompt must never fire off-device.
    expect(obtainNativeTokenDetailed).not.toHaveBeenCalled();
    expect(registerDevice).not.toHaveBeenCalled();
  });

  it('does nothing when nobody is signed in — the token would have no owner', async () => {
    currentUser = null;

    expect(await registerPushDevice()).toEqual({ outcome: 'not-signed-in' });
    expect(detectNativePlatform).not.toHaveBeenCalled();
  });

  it.each([['permission-denied' as const], ['registration-error' as const], ['timeout' as const]])(
    'reports %s rather than a single silent "no token"',
    async (reason) => {
      // These used to collapse into one outcome. They need different things from
      // the driver — switch notifications on, check the connection, retry — and a
      // field test on 2026-08-27 was spent unable to tell which had happened.
      obtainNativeTokenDetailed.mockResolvedValue({ token: null, reason });

      expect(await registerPushDevice()).toEqual({ outcome: reason });
      expect(registerDevice).not.toHaveBeenCalled();
      expect(pushOutcomeIsHealthy(reason)).toBe(false);
      expect(pushOutcomeMessage(reason)).toBeTruthy();
    },
  );

  it('is idempotent for the same account — the effect can run on every screen change', async () => {
    await registerPushDevice();
    const second = await registerPushDevice();

    expect(second).toEqual({ outcome: 'already', deviceId: 'device-1' });
    // The decisive part: no second OS prompt and no duplicate row.
    expect(obtainNativeTokenDetailed).toHaveBeenCalledTimes(1);
    expect(registerDevice).toHaveBeenCalledTimes(1);
  });

  describe('the stored id is a claim, not proof (field failure, 2026-08-27)', () => {
    // A driver sat online with a pending ride offer and their phone never rang.
    // localStorage said "registered on this device"; the server held no row. The
    // shortcut that makes this function cheap to call on every screen change was
    // also what made the failure permanent for the life of the install.

    it('re-registers when the server does not have the stored device', async () => {
      await registerPushDevice();
      expect(registerDevice).toHaveBeenCalledTimes(1);

      // The row is gone — deactivated, pruned, or never really created.
      __resetPushRegistrationForTests();
      listDevices.mockResolvedValue([]);
      registerDevice.mockResolvedValue({ id: 'device-2' });

      expect(await registerPushDevice()).toEqual({ outcome: 'registered', deviceId: 'device-2' });
      expect(registerDevice).toHaveBeenCalledTimes(2);
    });

    it('checks the server once per session, not on every screen change', async () => {
      await registerPushDevice();
      await registerPushDevice();
      await registerPushDevice();

      // The verification is a network call and this function runs on every
      // navigation; confirming it once is the whole point of the shortcut.
      expect(listDevices).toHaveBeenCalledTimes(1);
    });

    it('keeps the registration when the check itself fails', async () => {
      // Offline is not evidence the row is gone. Tearing down a working
      // registration on a dropped request would be the worse mistake.
      await registerPushDevice();
      __resetPushRegistrationForTests();
      listDevices.mockRejectedValue(new Error('offline'));

      expect(await registerPushDevice()).toEqual({ outcome: 'already', deviceId: 'device-1' });
      expect(registerDevice).toHaveBeenCalledTimes(1);
    });

    it('retry forces a fresh attempt even when storage says otherwise', async () => {
      await registerPushDevice();
      registerDevice.mockResolvedValue({ id: 'device-3' });

      expect(await retryPushRegistration()).toEqual({
        outcome: 'registered',
        deviceId: 'device-3',
      });
      expect(registerDevice).toHaveBeenCalledTimes(2);
    });
  });

  describe('the outcome is observable', () => {
    it('starts unknown and records what happened', async () => {
      expect(lastPushRegistration()).toBeNull();

      await registerPushDevice();

      expect(lastPushRegistration()).toEqual({ outcome: 'registered', deviceId: 'device-1' });
    });

    it('tells a subscriber, so a screen can show an unreachable driver they are unreachable', async () => {
      const seen: string[] = [];
      const stop = onPushRegistrationChange((result) => seen.push(result.outcome));

      obtainNativeTokenDetailed.mockResolvedValue({ token: null, reason: 'permission-denied' });
      await registerPushDevice();
      stop();
      obtainNativeTokenDetailed.mockResolvedValue({ token: 'x', reason: 'granted' });
      await retryPushRegistration();

      expect(seen).toEqual(['permission-denied']);
    });

    it('says nothing is wrong in a plain browser', () => {
      // No push off-device, and no fault either. Warning a desktop user their
      // alerts are broken would be false.
      expect(pushOutcomeIsHealthy('not-native')).toBe(true);
      expect(pushOutcomeMessage('not-native')).toBeNull();
      expect(pushOutcomeMessage('registered')).toBeNull();
    });
  });

  it('releases the previous account when a different person signs in on the same handset', async () => {
    await registerPushDevice();
    expect(registerDevice).toHaveBeenCalledTimes(1);

    currentUser = { id: 'user-2' };
    registerDevice.mockResolvedValue({ id: 'device-2' });
    const result = await registerPushDevice();

    // Without this the first account keeps receiving this device's notifications.
    expect(deactivateDevice).toHaveBeenCalledWith('device-1');
    expect(result).toEqual({ outcome: 'registered', deviceId: 'device-2' });
  });

  it('never throws when the backend rejects the registration', async () => {
    registerDevice.mockRejectedValue(new Error('500'));

    expect(await registerPushDevice()).toEqual({ outcome: 'failed' });
  });

  it('deregisters on sign-out and forgets the device locally', async () => {
    await registerPushDevice();

    await deregisterPushDevice();

    expect(deactivateDevice).toHaveBeenCalledWith('device-1');
    // Forgotten locally too, so a re-login registers fresh rather than
    // assuming a row that may since have been reaped.
    expect(localStorage.getItem('dx_push_device_id')).toBeNull();
  });

  it('deregistering an unregistered device is a no-op', async () => {
    await deregisterPushDevice();
    expect(deactivateDevice).not.toHaveBeenCalled();
  });

  it('signOutRequest releases the device BEFORE revoking the session', async () => {
    await registerPushDevice();
    const order: string[] = [];
    deactivateDevice.mockImplementation(() => {
      order.push('deactivate');
      return Promise.resolve();
    });
    logout.mockImplementation(() => {
      order.push('logout');
      return Promise.resolve();
    });

    await signOutRequest();

    // Reversed, the deactivate call would authenticate with a revoked token
    // and leave the row live.
    expect(order).toEqual(['deactivate', 'logout']);
  });

  it('stops the native presence service BEFORE revoking the session', async () => {
    await registerPushDevice();
    const order: string[] = [];
    stopPresence.mockImplementation(() => {
      order.push('presence');
      return Promise.resolve('stopped');
    });
    deactivateDevice.mockImplementation(() => {
      order.push('deactivate');
      return Promise.resolve();
    });
    logout.mockImplementation(() => {
      order.push('logout');
      return Promise.resolve();
    });

    await signOutRequest();

    // DPX-MOBILE-003: the service holds an access token and shows an ongoing
    // "You are online" notification. Left running past sign-out it reports a
    // driver who has left, on a token they no longer own.
    expect(order).toEqual(['presence', 'deactivate', 'logout']);
  });

  it('still signs out when stopping presence fails', async () => {
    await registerPushDevice();
    stopPresence.mockRejectedValue(new Error('plugin gone'));

    await expect(signOutRequest()).resolves.toBeUndefined();
    // A driver who cannot sign out is worse than a service that lingers until
    // the process dies.
    expect(logout).toHaveBeenCalled();
  });

  it('still signs out when releasing the device fails', async () => {
    await registerPushDevice();
    deactivateDevice.mockRejectedValue(new Error('offline'));

    await expect(signOutRequest()).resolves.toBeUndefined();
    expect(logout).toHaveBeenCalled();
  });
});

describe('ride alert channel (DPX-MOBILE-001)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createNativeNotificationChannel.mockResolvedValue('created');
  });

  it('creates the channel the backend addresses', async () => {
    await ensureRideAlertChannel();

    // The id is shared through @dripplex/types precisely so this cannot drift:
    // FCM does not error on a channel the app never created, it just delivers
    // quietly on its own fallback.
    expect(createNativeNotificationChannel).toHaveBeenCalledWith(
      expect.objectContaining({ id: RIDE_ALERT_ANDROID_CHANNEL_ID }),
    );
  });

  it('asks for maximum importance, so the alert interrupts', async () => {
    // At the default importance of 3 the notification appears silently in the
    // shade, which for an offer that expires in seconds is the same as not
    // sending it.
    expect(RIDE_ALERT_CHANNEL.importance).toBe(5);
  });

  it('asks for vibration explicitly, because the plugin defaults it off', async () => {
    // NotificationChannelManager.createChannel reads
    // `call.getBoolean(CHANNEL_VIBRATE, false)` — omitting this gives a silent
    // channel in a pocket even at importance 5.
    expect(RIDE_ALERT_CHANNEL.vibration).toBe(true);
  });

  it('names the ride tone, not the handset default', async () => {
    // This asserted `toBeUndefined()` until 2026-08-27, when the first real
    // offer to reach a driver rang on their phone's default chime and drew the
    // right complaint: "this sound is so slow". Android hands a channel the
    // system default when no filename is given, and a default chime is designed
    // not to alarm anyone — the opposite of what a sixty-second offer needs.
    expect(RIDE_ALERT_CHANNEL.sound).toBe('ride_alert');
  });

  it('deletes v1 first, so a driver is not left with two Ride requests entries', async () => {
    await ensureRideAlertChannel();

    // A channel's sound is fixed at creation, so the new tone needs a new id.
    // Without this delete the dead v1 channel stays visible in the driver's
    // notification settings for alerts that will never arrive on it again.
    expect(deleteNativeNotificationChannel).toHaveBeenCalledWith(RIDE_ALERT_ANDROID_CHANNEL_ID_V1);
  });

  it('puts the offer on the lock screen', async () => {
    // A driver decides whether a job is worth taking without unlocking.
    expect(RIDE_ALERT_CHANNEL.visibility).toBe(1);
  });

  it('never throws, whatever the platform says', async () => {
    createNativeNotificationChannel.mockResolvedValue('failed');

    await expect(ensureRideAlertChannel()).resolves.toBe('failed');
  });
});
