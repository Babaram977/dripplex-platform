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
vi.mock('@dripplex/hooks/driver/native-presence', () => ({
  startNativeDriverPresence: (o: unknown) => startNative(o),
  stopNativeDriverPresence: () => stopNative(),
  isNativeDriverPresenceRunning: () => isRunningNative(),
}));

let token: string | null = 'access-token-1';
vi.mock('./auth', () => ({
  auth: { getAccessToken: () => token },
}));

import { BASE } from './api';

import { isDriverPresenceRunning, startDriverPresence, stopDriverPresence } from './driverPresence';

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
});
