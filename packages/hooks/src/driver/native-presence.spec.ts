/**
 * DPX-MOBILE-003 — the regression guard for a plugin that was never reachable.
 *
 * The first release of `native-presence.ts` read the plugin out of
 * `Capacitor.Plugins`, which the Android bridge never populates: only
 * `registerPlugin` writes that object, and nothing registered this plugin. The
 * whole feature was dead on device — no bubble, no ongoing notification, and no
 * native heartbeat, so a minimised driver still went invisible to dispatch
 * after four minutes.
 *
 * It shipped because the app's own tests mock `@dripplex/hooks/driver/native-presence`
 * wholesale (see apps/super-app/src/lib/driverPresence.test.ts), so the one
 * function that was wrong — `resolvePlugin` — had no test at all.
 *
 * So the mock below is built to be the device: `Plugins` is an EMPTY object,
 * exactly as the bridge leaves it, and the only route to the plugin is
 * `registerPlugin`. Any implementation that goes back to reading
 * `Capacitor.Plugins` fails here instead of on a driver's phone.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as NativePresence from './native-presence';

const isNativePlatform = vi.fn();
const getPlatform = vi.fn();
const isPluginAvailable = vi.fn();
const registerPlugin = vi.fn();

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform() as boolean,
    getPlatform: () => getPlatform() as string,
    isPluginAvailable: (name: string) => isPluginAvailable(name) as boolean,
    // Empty, as on a real handset. The bridge injects PluginHeaders, never this.
    Plugins: {},
  },
  registerPlugin: (name: string) => registerPlugin(name) as unknown,
}));

const start = vi.fn();
const stop = vi.fn();
const isRunning = vi.fn();
const updateToken = vi.fn();
const hasOverlay = vi.fn();
const requestOverlay = vi.fn();

const plugin = {
  start,
  stop,
  isRunning,
  updateToken,
  hasOverlayPermission: hasOverlay,
  requestOverlayPermission: requestOverlay,
};

const OPTIONS = {
  baseUrl: 'https://api.dripplex.com/api/v1',
  token: 't',
  presencePath: '/driver/rides/availability',
  presenceBody: { online: true, acceptingRides: true, vehicleType: 'ECONOMY' },
};

/** Fresh module every time — the plugin proxy is cached at module scope. */
async function load(): Promise<typeof NativePresence> {
  vi.resetModules();
  return await import('./native-presence');
}

beforeEach(() => {
  isNativePlatform.mockReturnValue(true);
  getPlatform.mockReturnValue('android');
  isPluginAvailable.mockReturnValue(true);
  registerPlugin.mockReturnValue(plugin);
  start.mockResolvedValue({ started: true });
  stop.mockResolvedValue(undefined);
  isRunning.mockResolvedValue({ running: true });
  updateToken.mockResolvedValue(undefined);
  hasOverlay.mockResolvedValue({ granted: true });
  requestOverlay.mockResolvedValue({ opened: true, granted: false });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('startNativeDriverPresence', () => {
  it('registers the plugin and starts the service on Android', async () => {
    const { startNativeDriverPresence } = await load();

    await expect(startNativeDriverPresence(OPTIONS)).resolves.toBe('started');
    expect(registerPlugin).toHaveBeenCalledWith('DriverPresence');
    expect(start).toHaveBeenCalledWith({
      baseUrl: OPTIONS.baseUrl,
      token: 't',
      presencePath: '/driver/rides/availability',
      presenceBody: { online: true, acceptingRides: true, vehicleType: 'ECONOMY' },
    });
  });

  it('sends the rider its own endpoint and body, not the driver ones', async () => {
    // The whole point of the generalisation. The native service was hardcoded
    // to /driver/rides/availability, so a rider going online through it would
    // have posted a driver's shape to a driver's endpoint under a rider's
    // token — silently reporting nothing usable while claiming to be live.
    const { startNativeDriverPresence } = await load();

    await startNativeDriverPresence({
      baseUrl: OPTIONS.baseUrl,
      token: 't',
      presencePath: '/rider/availability',
      presenceBody: { online: true, acceptingOrders: true },
      onlineText: 'DrippleX can send you deliveries',
    });

    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        presencePath: '/rider/availability',
        presenceBody: { online: true, acceptingOrders: true },
        onlineText: 'DrippleX can send you deliveries',
      }),
    );
  });

  it('omits onlineText when the caller names none, leaving the native default', async () => {
    const { startNativeDriverPresence } = await load();

    await startNativeDriverPresence(OPTIONS);

    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0]?.[0]).not.toHaveProperty('onlineText');
  });

  it('forwards the seed position, which the service cannot be relied on to find', async () => {
    const { startNativeDriverPresence } = await load();

    await startNativeDriverPresence({ ...OPTIONS, latitude: 12.0120021, longitude: 8.5803975 });

    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 12.0120021, longitude: 8.5803975 }),
    );
  });

  it('sends neither coordinate when only one is given', async () => {
    const { startNativeDriverPresence } = await load();

    await startNativeDriverPresence({ ...OPTIONS, latitude: 12.0120021 });

    // Half a pair would seed a position on the equator, which is worse than no
    // seed at all — the service would report it as fact.
    const sent = start.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(sent).not.toHaveProperty('latitude');
    expect(sent).not.toHaveProperty('longitude');
  });

  it('registers once across repeated calls', async () => {
    const { startNativeDriverPresence, stopNativeDriverPresence } = await load();

    await startNativeDriverPresence(OPTIONS);
    await stopNativeDriverPresence();
    await startNativeDriverPresence(OPTIONS);

    // Capacitor logs "Cannot register plugins twice" and hands back the same
    // proxy, so a second call is harmless — but a driver toggling their shift
    // should not fill the console with it.
    expect(registerPlugin).toHaveBeenCalledTimes(1);
  });

  it('reports no-plugin — not not-android — when the shell lacks the Java', async () => {
    isPluginAvailable.mockReturnValue(false);
    const { startNativeDriverPresence } = await load();

    // The distinction is the point: "not-android" on an Android phone is what
    // made the original failure read as an expected platform check.
    await expect(startNativeDriverPresence(OPTIONS)).resolves.toBe('no-plugin');
    expect(registerPlugin).not.toHaveBeenCalled();
  });

  it('does not touch the plugin on iOS', async () => {
    getPlatform.mockReturnValue('ios');
    const { startNativeDriverPresence } = await load();

    await expect(startNativeDriverPresence(OPTIONS)).resolves.toBe('not-android');
    expect(registerPlugin).not.toHaveBeenCalled();
  });

  it('does not touch the plugin in a browser', async () => {
    isNativePlatform.mockReturnValue(false);
    const { startNativeDriverPresence } = await load();

    await expect(startNativeDriverPresence(OPTIONS)).resolves.toBe('not-android');
    expect(registerPlugin).not.toHaveBeenCalled();
  });

  it('refuses to start a service that could report nothing', async () => {
    const { startNativeDriverPresence } = await load();

    await expect(startNativeDriverPresence({ ...OPTIONS, token: '' })).resolves.toBe('unavailable');
    expect(start).not.toHaveBeenCalled();
  });

  it('never throws when the platform call rejects', async () => {
    start.mockRejectedValue(new Error('ForegroundServiceStartNotAllowedException'));
    const { startNativeDriverPresence } = await load();

    await expect(startNativeDriverPresence(OPTIONS)).resolves.toBe('failed');
  });
});

describe('stopNativeDriverPresence', () => {
  it('stops the service', async () => {
    const { stopNativeDriverPresence } = await load();

    await expect(stopNativeDriverPresence()).resolves.toBe('stopped');
    expect(stop).toHaveBeenCalled();
  });

  it('never throws when the platform call rejects', async () => {
    stop.mockRejectedValue(new Error('dead'));
    const { stopNativeDriverPresence } = await load();

    await expect(stopNativeDriverPresence()).resolves.toBe('failed');
  });
});

describe('updateNativePresenceToken', () => {
  it('hands the running service a fresh token', async () => {
    const { updateNativePresenceToken } = await load();

    await updateNativePresenceToken('fresh-token');

    expect(updateToken).toHaveBeenCalledWith({ token: 'fresh-token' });
  });

  it('ignores an empty token rather than clearing a working one', async () => {
    const { updateNativePresenceToken } = await load();

    await updateNativePresenceToken('');

    expect(updateToken).not.toHaveBeenCalled();
  });

  it('never throws — a failed update must not break the refresh that caused it', async () => {
    updateToken.mockRejectedValue(new Error('not running'));
    const { updateNativePresenceToken } = await load();

    await expect(updateNativePresenceToken('fresh-token')).resolves.toBeUndefined();
  });

  it('is a no-op off Android', async () => {
    getPlatform.mockReturnValue('ios');
    const { updateNativePresenceToken } = await load();

    await updateNativePresenceToken('fresh-token');

    expect(updateToken).not.toHaveBeenCalled();
  });
});

describe('isNativeDriverPresenceRunning', () => {
  it('reports what the service says', async () => {
    const { isNativeDriverPresenceRunning } = await load();

    await expect(isNativeDriverPresenceRunning()).resolves.toBe(true);
  });

  it('is false on failure — never concludes running from an error', async () => {
    isRunning.mockRejectedValue(new Error('nope'));
    const { isNativeDriverPresenceRunning } = await load();

    await expect(isNativeDriverPresenceRunning()).resolves.toBe(false);
  });
});

describe('overlay permission', () => {
  it('reads the granted state through the registered plugin', async () => {
    const { hasOverlayPermission } = await load();

    await expect(hasOverlayPermission()).resolves.toBe(true);
    expect(registerPlugin).toHaveBeenCalledWith('DriverPresence');
  });

  it('is false on failure — never promises a bubble that cannot appear', async () => {
    hasOverlay.mockRejectedValue(new Error('nope'));
    const { hasOverlayPermission } = await load();

    await expect(hasOverlayPermission()).resolves.toBe(false);
  });

  it('opens Settings and reports that it cannot know the outcome', async () => {
    const { requestOverlayPermission } = await load();

    await expect(requestOverlayPermission()).resolves.toEqual({ opened: true, granted: false });
  });

  it('survives an OEM build with no such Settings screen', async () => {
    requestOverlay.mockRejectedValue(new Error('ActivityNotFoundException'));
    const { requestOverlayPermission } = await load();

    await expect(requestOverlayPermission()).resolves.toEqual({ opened: false, granted: false });
  });
});
