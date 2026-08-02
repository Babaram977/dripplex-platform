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
});
