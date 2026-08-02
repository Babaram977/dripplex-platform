import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
    getPlatform: vi.fn(),
  },
}));

vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    requestPermissions: vi.fn(),
    addListener: vi.fn(),
    register: vi.fn(),
  },
}));

describe('detectNativePlatform', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when not running inside a native shell', async () => {
    const { Capacitor } = await import('@capacitor/core');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    const { detectNativePlatform } = await import('./native-push');

    await expect(detectNativePlatform()).resolves.toBeNull();
  });

  it('maps the native platform to IOS/ANDROID', async () => {
    const { Capacitor } = await import('@capacitor/core');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
    const { detectNativePlatform } = await import('./native-push');

    await expect(detectNativePlatform()).resolves.toBe('ANDROID');
  });
});

describe('obtainNativeToken', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when permission is denied', async () => {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vi.mocked() never invokes with `this`
    vi.mocked(PushNotifications.requestPermissions).mockResolvedValue({ receive: 'denied' });
    const { obtainNativeToken } = await import('./native-push');

    await expect(obtainNativeToken()).resolves.toBeNull();
  });

  it('resolves the token from the registration listener', async () => {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vi.mocked() never invokes with `this`
    vi.mocked(PushNotifications.requestPermissions).mockResolvedValue({ receive: 'granted' });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vi.mocked() never invokes with `this`
    const addListener = PushNotifications.addListener as unknown as (
      event: string,
      handler: (payload: { value: string }) => void,
    ) => Promise<{ remove: () => void }>;
    vi.mocked(addListener).mockImplementation((event, handler) => {
      if (event === 'registration') {
        queueMicrotask(() => {
          handler({ value: 'fcm-tok' });
        });
      }
      return Promise.resolve({ remove: vi.fn() });
    });

    const { obtainNativeToken } = await import('./native-push');

    await expect(obtainNativeToken()).resolves.toBe('fcm-tok');
  });
});

describe('listenForNativeNotificationTaps', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns null on a non-native platform', async () => {
    const { Capacitor } = await import('@capacitor/core');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    const { listenForNativeNotificationTaps } = await import('./native-push');

    await expect(listenForNativeNotificationTaps(vi.fn())).resolves.toBeNull();
  });

  it('maps a tapped notification action to notificationId/deepLink', async () => {
    const { Capacitor } = await import('@capacitor/core');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android');

    const { PushNotifications } = await import('@capacitor/push-notifications');
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vi.mocked() never invokes with `this`
    const addListener = PushNotifications.addListener as unknown as (
      event: string,
      handler: (action: { notification: { data: Record<string, unknown> } }) => void,
    ) => Promise<{ remove: () => void }>;
    vi.mocked(addListener).mockImplementation((event, handler) => {
      if (event === 'pushNotificationActionPerformed') {
        handler({ notification: { data: { notificationId: 'notif-1', deepLink: '/ride' } } });
      }
      return Promise.resolve({ remove: vi.fn() });
    });

    const { listenForNativeNotificationTaps } = await import('./native-push');
    const onTap = vi.fn();
    const unsubscribe = await listenForNativeNotificationTaps(onTap);

    expect(onTap).toHaveBeenCalledWith({ notificationId: 'notif-1', deepLink: '/ride' });
    expect(unsubscribe).toBeInstanceOf(Function);
  });
});
