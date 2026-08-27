import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * DPX-MOBILE-003. The native service is the half that cannot be tested here —
 * it is Kotlin-adjacent Java running on a handset. What CAN be tested, and is
 * what actually broke in the field, is the wiring: whether the shift is handed
 * over with a real token and origin, and whether it is handed back on the way
 * out.
 */

const startNative = vi.fn();
const stopNative = vi.fn();
const isRunningNative = vi.fn();
const hasOverlay = vi.fn();
const requestOverlay = vi.fn();
vi.mock('@dripplex/hooks/driver/native-presence', () => ({
  startNativeDriverPresence: (o: unknown) => startNative(o),
  stopNativeDriverPresence: () => stopNative(),
  isNativeDriverPresenceRunning: () => isRunningNative(),
  hasOverlayPermission: () => hasOverlay(),
  requestOverlayPermission: () => requestOverlay(),
}));

let token: string | null = 'access-token-1';
vi.mock('./auth', () => ({
  auth: { getAccessToken: () => token },
}));

import { BASE } from './api';

import {
  hasOverlayPermission,
  isDriverPresenceRunning,
  requestOverlayPermission,
  startDriverPresence,
  stopDriverPresence,
} from './driverPresence';

describe('driver presence hand-off (DPX-MOBILE-003)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    token = 'access-token-1';
    startNative.mockResolvedValue('started');
    stopNative.mockResolvedValue('stopped');
    isRunningNative.mockResolvedValue(false);
  });

  it('hands the service the same API origin the web client uses', async () => {
    await startDriverPresence({ vehicleType: 'ECONOMY', acceptingRides: true });

    // A service posting to the wrong host fails silently — it just looks like a
    // driver who stopped reporting. Sharing the constant is what stops the two
    // from drifting.
    expect(startNative).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: BASE, token: 'access-token-1', vehicleType: 'ECONOMY' }),
    );
  });

  it('refuses to start without a token instead of starting a mute service', async () => {
    token = null;

    expect(await startDriverPresence({ vehicleType: 'ECONOMY' })).toBe('not-signed-in');
    // Started tokenless, the service would show "You are online" while
    // reporting nothing — the exact failure this feature exists to remove.
    expect(startNative).not.toHaveBeenCalled();
  });

  it('passes the delivery preference through only when it was given', async () => {
    await startDriverPresence({ vehicleType: 'XL', acceptingDeliveries: true });
    expect(startNative).toHaveBeenCalledWith(
      expect.objectContaining({ acceptingDeliveries: true }),
    );

    startNative.mockClear();
    await startDriverPresence({ vehicleType: 'XL' });
    // Absent means "leave it alone" on the availability write. Sending a
    // default would opt a driver out of deliveries every minute of their shift.
    expect(startNative.mock.calls[0]?.[0]).not.toHaveProperty('acceptingDeliveries');
  });

  it('reports the platform verdict rather than throwing', async () => {
    startNative.mockResolvedValue('not-android');
    expect(await startDriverPresence({ vehicleType: 'ECONOMY' })).toBe('not-android');

    startNative.mockResolvedValue('failed');
    expect(await startDriverPresence({ vehicleType: 'ECONOMY' })).toBe('failed');
  });

  it('stops without needing a token, because sign-out has already cleared it', async () => {
    token = null;
    expect(await stopDriverPresence()).toBe('stopped');
    expect(stopNative).toHaveBeenCalled();
  });

  it('never reports "running" from a failure', async () => {
    isRunningNative.mockResolvedValue(false);
    expect(await isDriverPresenceRunning()).toBe(false);
  });

  describe('the floating bubble permission (founder decision 2026-08-27)', () => {
    it('never blocks going online on the overlay permission', async () => {
      hasOverlay.mockResolvedValue(false);

      expect(await startDriverPresence({ vehicleType: 'ECONOMY' })).toBe('started');
      // The bubble is strictly additive. A driver who declines it keeps a fully
      // working shift — service, reporting and notification all unaffected — so
      // nothing in the online path may consult it.
      expect(hasOverlay).not.toHaveBeenCalled();
    });

    it('reports the permission rather than guessing', async () => {
      hasOverlay.mockResolvedValue(true);
      expect(await hasOverlayPermission()).toBe(true);

      hasOverlay.mockResolvedValue(false);
      expect(await hasOverlayPermission()).toBe(false);
    });

    it('does not claim the permission was granted just because Settings opened', async () => {
      requestOverlay.mockResolvedValue({ opened: true, granted: false });

      // SYSTEM_ALERT_WINDOW has no runtime dialog: the driver decides in
      // another app and may walk straight back. Treating "opened" as "granted"
      // would promise a bubble that never appears.
      expect(await requestOverlayPermission()).toEqual({ opened: true, granted: false });
    });

    it('says so when it was already granted, without opening anything', async () => {
      requestOverlay.mockResolvedValue({ opened: false, granted: true });
      expect(await requestOverlayPermission()).toEqual({ opened: false, granted: true });
    });
  });
});
