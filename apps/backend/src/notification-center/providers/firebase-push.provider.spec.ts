import { FirebasePushProvider } from './firebase-push.provider';

import type { DeviceRegistryService } from '../device-registry.service';
import type { DeviceToken, Notification } from '@prisma/client';
import type { Messaging } from 'firebase-admin/messaging';

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notif-1',
    userId: 'user-1',
    category: 'RIDE',
    channel: 'PUSH',
    type: 'RIDE_DRIVER_ASSIGNED',
    priority: 'NORMAL',
    status: 'QUEUED',
    title: 'Driver assigned',
    body: 'A driver has been assigned to your ride.',
    templateCode: null,
    payload: null,
    scheduledAt: null,
    expiresAt: null,
    sentAt: null,
    readAt: null,
    failureReason: null,
    retryCount: 0,
    maxRetries: 3,
    deadLetteredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function makeDevice(overrides: Partial<DeviceToken> = {}): DeviceToken {
  return {
    id: 'device-1',
    userId: 'user-1',
    platform: 'ANDROID',
    token: 'fcm-token-1',
    active: true,
    lastSeenAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('FirebasePushProvider', () => {
  it('reports configured with no messageId when the user has no registered devices', async () => {
    const sendEach = jest.fn();
    const messaging = { sendEach } as unknown as Messaging;
    const deviceRegistry = {
      list: jest.fn().mockResolvedValue([]),
    } as unknown as DeviceRegistryService;
    const provider = new FirebasePushProvider(messaging, deviceRegistry);

    const result = await provider.send(makeNotification());

    expect(result).toEqual({ configured: true, provider: 'fcm' });
    expect(sendEach).not.toHaveBeenCalled();
  });

  it('sends to every active device and returns the first successful messageId', async () => {
    const sendEach = jest.fn().mockResolvedValue({
      responses: [{ success: true, messageId: 'msg-1' }],
    });
    const messaging = { sendEach } as unknown as Messaging;
    const devices = [makeDevice()];
    const deviceRegistry = {
      list: jest.fn().mockResolvedValue(devices),
      deactivate: jest.fn(),
    } as unknown as DeviceRegistryService;
    const provider = new FirebasePushProvider(messaging, deviceRegistry);

    const result = await provider.send(makeNotification());

    expect(sendEach).toHaveBeenCalledWith([expect.objectContaining({ token: 'fcm-token-1' })]);
    expect(result).toEqual({ configured: true, provider: 'fcm', providerMessageId: 'msg-1' });
    expect(deviceRegistry.deactivate).not.toHaveBeenCalled();
  });

  it('deactivates device tokens FCM reports as unregistered', async () => {
    const sendEach = jest.fn().mockResolvedValue({
      responses: [
        { success: false, error: { code: 'messaging/registration-token-not-registered' } },
      ],
    });
    const messaging = { sendEach } as unknown as Messaging;
    const devices = [makeDevice({ id: 'device-stale' })];
    const deviceRegistry = {
      list: jest.fn().mockResolvedValue(devices),
      deactivate: jest.fn().mockResolvedValue(undefined),
    } as unknown as DeviceRegistryService;
    const provider = new FirebasePushProvider(messaging, deviceRegistry);

    const result = await provider.send(makeNotification());

    expect(deviceRegistry.deactivate).toHaveBeenCalledWith('user-1', 'device-stale');
    expect(result).toEqual({ configured: true, provider: 'fcm' });
  });

  it('forwards payload.deepLink as FCM data.deepLink when present', async () => {
    const sendEach = jest.fn().mockResolvedValue({
      responses: [{ success: true, messageId: 'msg-1' }],
    });
    const messaging = { sendEach } as unknown as Messaging;
    const devices = [makeDevice()];
    const deviceRegistry = {
      list: jest.fn().mockResolvedValue(devices),
      deactivate: jest.fn(),
    } as unknown as DeviceRegistryService;
    const provider = new FirebasePushProvider(messaging, deviceRegistry);

    await provider.send(makeNotification({ payload: { version: 1, deepLink: '/ride' } }));

    expect(sendEach).toHaveBeenCalledWith([
      expect.objectContaining({ data: expect.objectContaining({ deepLink: '/ride' }) }),
    ]);
  });

  it('omits deepLink from FCM data when the notification has none', async () => {
    const sendEach = jest.fn().mockResolvedValue({
      responses: [{ success: true, messageId: 'msg-1' }],
    });
    const messaging = { sendEach } as unknown as Messaging;
    const devices = [makeDevice()];
    const deviceRegistry = {
      list: jest.fn().mockResolvedValue(devices),
      deactivate: jest.fn(),
    } as unknown as DeviceRegistryService;
    const provider = new FirebasePushProvider(messaging, deviceRegistry);

    await provider.send(makeNotification({ payload: { version: 1 } }));

    const call = sendEach.mock.calls[0]?.[0] as { data: Record<string, unknown> }[];
    expect(call[0]?.data).not.toHaveProperty('deepLink');
  });

  it('does not deactivate tokens that failed for a transient reason', async () => {
    const sendEach = jest.fn().mockResolvedValue({
      responses: [{ success: false, error: { code: 'messaging/internal-error' } }],
    });
    const messaging = { sendEach } as unknown as Messaging;
    const devices = [makeDevice({ id: 'device-transient' })];
    const deviceRegistry = {
      list: jest.fn().mockResolvedValue(devices),
      deactivate: jest.fn(),
    } as unknown as DeviceRegistryService;
    const provider = new FirebasePushProvider(messaging, deviceRegistry);

    await provider.send(makeNotification());

    expect(deviceRegistry.deactivate).not.toHaveBeenCalled();
  });

  describe('DPX-MOBILE-001 — Android delivery options', () => {
    function setup(notification: Notification): {
      provider: FirebasePushProvider;
      sendEach: jest.Mock;
      notification: Notification;
    } {
      const sendEach = jest.fn().mockResolvedValue({
        responses: [{ success: true, messageId: 'm-1' }],
        successCount: 1,
        failureCount: 0,
      });
      const messaging = { sendEach } as unknown as Messaging;
      const deviceRegistry = {
        list: jest.fn().mockResolvedValue([makeDevice()]),
        deactivate: jest.fn(),
      } as unknown as DeviceRegistryService;
      const provider = new FirebasePushProvider(messaging, deviceRegistry);
      return { provider, sendEach, notification };
    }

    it('sends a CRITICAL notification at high priority so it wakes a device in Doze', async () => {
      const expiresAt = new Date(Date.now() + 60_000).toISOString();
      const { provider, sendEach } = setup(
        makeNotification({ priority: 'CRITICAL', type: 'RIDE_OFFERED', payload: { expiresAt } }),
      );

      await provider.send(
        makeNotification({ priority: 'CRITICAL', type: 'RIDE_OFFERED', payload: { expiresAt } }),
      );

      expect(sendEach.mock.calls[0][0][0].android.priority).toBe('high');
    });

    it('gives the push a TTL from the offer expiry, so a dead offer never rings', async () => {
      const expiresAt = new Date(Date.now() + 60_000).toISOString();
      const { provider, sendEach } = setup(makeNotification());

      await provider.send(
        makeNotification({ priority: 'CRITICAL', type: 'RIDE_OFFERED', payload: { expiresAt } }),
      );

      const ttl = sendEach.mock.calls[0][0][0].android.ttl;
      // Wall-clock sensitive by nature; the assertion is that it is the
      // remaining window, not a constant.
      expect(ttl).toBeGreaterThan(50_000);
      expect(ttl).toBeLessThanOrEqual(60_000);
    });

    it('clamps an already-expired offer to zero rather than sending a negative TTL', async () => {
      const expiresAt = new Date(Date.now() - 5_000).toISOString();
      const { provider, sendEach } = setup(makeNotification());

      await provider.send(
        makeNotification({ priority: 'CRITICAL', type: 'RIDE_OFFERED', payload: { expiresAt } }),
      );

      // FCM rejects a negative ttl outright, which would fail the whole send.
      expect(sendEach.mock.calls[0][0][0].android.ttl).toBe(0);
    });

    it('omits the TTL when the payload carries no expiry', async () => {
      const { provider, sendEach } = setup(makeNotification());

      await provider.send(makeNotification({ priority: 'CRITICAL', payload: null }));

      expect(sendEach.mock.calls[0][0][0].android).toEqual({ priority: 'high' });
    });

    it('leaves a NORMAL notification on FCM defaults — high priority is not the default', async () => {
      const { provider, sendEach } = setup(makeNotification());

      await provider.send(makeNotification({ priority: 'NORMAL' }));

      // Google throttles senders that mark everything high-priority.
      expect(sendEach.mock.calls[0][0][0].android).toBeUndefined();
    });
  });
});
