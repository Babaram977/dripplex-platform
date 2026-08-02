import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listenForForegroundMessages } from './foreground-push';

import type { FirebaseWebConfig } from './push-types';

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn().mockReturnValue({ name: 'app' }),
  getApps: vi.fn().mockReturnValue([]),
  getApp: vi.fn().mockReturnValue({ name: 'app' }),
}));

vi.mock('firebase/messaging', () => ({
  getMessaging: vi.fn().mockReturnValue({}),
  onMessage: vi.fn(),
  isSupported: vi.fn().mockResolvedValue(true),
}));

const config: FirebaseWebConfig = {
  apiKey: 'key',
  authDomain: 'dripplex.firebaseapp.com',
  projectId: 'dripplex-3a92d',
  messagingSenderId: '123',
  appId: '1:123:web:abc',
};

describe('listenForForegroundMessages', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns null when Firebase web config is missing', async () => {
    await expect(listenForForegroundMessages(undefined, vi.fn())).resolves.toBeNull();
  });

  it('subscribes and maps message fields onto the payload', async () => {
    const { onMessage } = await import('firebase/messaging');
    const unsubscribe = vi.fn();
    vi.mocked(onMessage).mockImplementation((_messaging, handler) => {
      const callback = handler as (message: unknown) => void;
      callback({
        notification: { title: 'Driver assigned', body: 'A driver is on the way' },
        data: { notificationId: 'notif-1', deepLink: '/ride' },
      });
      return unsubscribe;
    });

    const onPayload = vi.fn();
    const returned = await listenForForegroundMessages(config, onPayload);

    expect(onPayload).toHaveBeenCalledWith({
      notificationId: 'notif-1',
      title: 'Driver assigned',
      body: 'A driver is on the way',
      deepLink: '/ride',
    });
    expect(returned).toBe(unsubscribe);
  });
});
