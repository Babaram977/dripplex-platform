import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FirebaseWebConfig } from './push-types';

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn().mockReturnValue({ name: 'app' }),
  getApps: vi.fn().mockReturnValue([]),
  getApp: vi.fn().mockReturnValue({ name: 'app' }),
}));

vi.mock('firebase/messaging', () => ({
  getMessaging: vi.fn().mockReturnValue({}),
  getToken: vi.fn(),
  isSupported: vi.fn().mockResolvedValue(true),
}));

const config: FirebaseWebConfig = {
  apiKey: 'key',
  authDomain: 'dripplex.firebaseapp.com',
  projectId: 'dripplex-3a92d',
  messagingSenderId: '123',
  appId: '1:123:web:abc',
};

describe('obtainWebToken', () => {
  let requestPermission: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    requestPermission = vi.fn().mockResolvedValue('granted');
    vi.stubGlobal('window', {});
    vi.stubGlobal('Notification', { requestPermission });
    vi.stubGlobal('navigator', {
      serviceWorker: { register: vi.fn().mockResolvedValue({}) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns null when Firebase web config or vapid key is missing', async () => {
    const { obtainWebToken } = await import('./web-push');

    await expect(obtainWebToken(undefined, 'vapid')).resolves.toBeNull();
    await expect(obtainWebToken(config, undefined)).resolves.toBeNull();
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('returns null when the user denies permission', async () => {
    requestPermission.mockResolvedValue('denied');
    const { obtainWebToken } = await import('./web-push');

    await expect(obtainWebToken(config, 'vapid-key')).resolves.toBeNull();
  });

  it('returns the FCM token once permission is granted', async () => {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- see web-push.ts for why getToken is still used
    const { getToken } = await import('firebase/messaging');
    vi.mocked(getToken).mockResolvedValue('web-fcm-token');
    const { obtainWebToken } = await import('./web-push');

    await expect(obtainWebToken(config, 'vapid-key')).resolves.toBe('web-fcm-token');
  });
});
