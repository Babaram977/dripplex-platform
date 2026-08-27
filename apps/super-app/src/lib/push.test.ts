import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mocked before the module under test is imported, so its top-level imports
// bind to these rather than the real Capacitor / API / auth modules.
const detectNativePlatform = vi.fn();
const obtainNativeToken = vi.fn();
const createNativeNotificationChannel = vi.fn();
vi.mock('@dripplex/hooks/notifications/native-push', () => ({
  detectNativePlatform: () => detectNativePlatform(),
  obtainNativeToken: () => obtainNativeToken(),
  createNativeNotificationChannel: (channel: unknown) => createNativeNotificationChannel(channel),
}));

const stopPresence = vi.fn();
vi.mock('./driverPresence', () => ({
  stopDriverPresence: () => stopPresence(),
}));

const registerDevice = vi.fn();
const deactivateDevice = vi.fn();
const logout = vi.fn();
vi.mock('./api', () => ({
  api: {
    devices: {
      register: (body: unknown) => registerDevice(body),
      deactivate: (id: string) => deactivateDevice(id),
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

import { RIDE_ALERT_ANDROID_CHANNEL_ID } from '@dripplex/types';

import {
  __resetPushRegistrationForTests,
  deregisterPushDevice,
  ensureRideAlertChannel,
  registerPushDevice,
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
    obtainNativeToken.mockResolvedValue('fcm-token-abc');
    registerDevice.mockResolvedValue({ id: 'device-1' });
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
    expect(obtainNativeToken).not.toHaveBeenCalled();
    expect(registerDevice).not.toHaveBeenCalled();
  });

  it('does nothing when nobody is signed in — the token would have no owner', async () => {
    currentUser = null;

    expect(await registerPushDevice()).toEqual({ outcome: 'not-signed-in' });
    expect(detectNativePlatform).not.toHaveBeenCalled();
  });

  it('treats a declined permission as a silent outcome, not a failure', async () => {
    obtainNativeToken.mockResolvedValue(null);

    expect(await registerPushDevice()).toEqual({ outcome: 'no-token' });
    expect(registerDevice).not.toHaveBeenCalled();
  });

  it('is idempotent for the same account — the effect can run on every screen change', async () => {
    await registerPushDevice();
    const second = await registerPushDevice();

    expect(second).toEqual({ outcome: 'already', deviceId: 'device-1' });
    // The decisive part: no second OS prompt and no duplicate row.
    expect(obtainNativeToken).toHaveBeenCalledTimes(1);
    expect(registerDevice).toHaveBeenCalledTimes(1);
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

  it('names no sound file, which is what selects the system default sound', async () => {
    // The app ships nothing in res/raw. Android constructs a channel with the
    // default notification sound already set, and the plugin only overrides it
    // when a filename is given — so omitting this is the sound, not the absence
    // of one. A distinctive DrippleX tone is a real asset decision, recorded in
    // docs/mobile/PUSH-NOTIFICATIONS.md rather than invented here.
    expect(RIDE_ALERT_CHANNEL.sound).toBeUndefined();
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
