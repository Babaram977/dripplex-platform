import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mocked before the module under test is imported, so its top-level imports
// bind to these rather than the real Capacitor / API / auth modules.
const detectNativePlatform = vi.fn();
const obtainNativeToken = vi.fn();
vi.mock('@dripplex/hooks/notifications/native-push', () => ({
  detectNativePlatform: () => detectNativePlatform(),
  obtainNativeToken: () => obtainNativeToken(),
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

import {
  __resetPushRegistrationForTests,
  deregisterPushDevice,
  registerPushDevice,
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

  it('still signs out when releasing the device fails', async () => {
    await registerPushDevice();
    deactivateDevice.mockRejectedValue(new Error('offline'));

    await expect(signOutRequest()).resolves.toBeUndefined();
    expect(logout).toHaveBeenCalled();
  });
});
