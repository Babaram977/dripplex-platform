import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  playNotificationChime,
  setAppBadgeCount,
  vibrateForNotification,
} from './notification-effects';

describe('playNotificationChime', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does nothing when AudioContext is unavailable', () => {
    vi.stubGlobal('window', {});
    expect(() => {
      playNotificationChime();
    }).not.toThrow();
  });

  it('creates and starts an oscillator when AudioContext exists', () => {
    const start = vi.fn();
    const stop = vi.fn();
    const connect = vi.fn();
    const oscillator = { type: '', frequency: { value: 0 }, connect, start, stop, onended: null };
    const gainConnect = vi.fn();
    const gain = {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: gainConnect,
    };
    const close = vi.fn();
    const AudioContextMock = vi.fn().mockImplementation(() => ({
      createOscillator: () => oscillator,
      createGain: () => gain,
      destination: {},
      currentTime: 0,
      close,
    }));
    vi.stubGlobal('window', { AudioContext: AudioContextMock });

    playNotificationChime();

    expect(AudioContextMock).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
  });
});

describe('vibrateForNotification', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does nothing when navigator.vibrate is unavailable', () => {
    vi.stubGlobal('navigator', {});
    expect(() => {
      vibrateForNotification();
    }).not.toThrow();
  });

  it('calls navigator.vibrate with a short pattern', () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });

    vibrateForNotification();

    expect(vibrate).toHaveBeenCalledWith([80, 40, 80]);
  });
});

describe('setAppBadgeCount', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls setAppBadge when count is positive and supported', async () => {
    const setAppBadge = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { setAppBadge });

    await setAppBadgeCount(3);

    expect(setAppBadge).toHaveBeenCalledWith(3);
  });

  it('calls clearAppBadge when count is zero', async () => {
    const clearAppBadge = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clearAppBadge });

    await setAppBadgeCount(0);

    expect(clearAppBadge).toHaveBeenCalledTimes(1);
  });

  it('does not throw when the Badging API is unsupported', async () => {
    vi.stubGlobal('navigator', {});
    await expect(setAppBadgeCount(2)).resolves.toBeUndefined();
  });
});
