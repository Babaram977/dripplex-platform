import {
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  NotificationType,
} from '@prisma/client';

import { NotificationCenterService } from './notification-center.service';

import type { NotificationPreferencesService } from './notification-preferences.service';
import type { NotificationTemplateService } from './notification-template.service';
import type { AuditService } from '../audit/audit.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { Notification } from '@prisma/client';

const notificationId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';

const makeNotification = (
  status: NotificationStatus,
  overrides: Partial<Notification> = {},
): Notification => ({
  id: notificationId,
  userId,
  channel: NotificationChannel.IN_APP,
  type: NotificationType.WELCOME,
  priority: NotificationPriority.NORMAL,
  status,
  title: 'Welcome',
  body: 'Hello',
  templateCode: null,
  payload: null,
  scheduledAt: null,
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
});

describe('NotificationCenterService', () => {
  let prisma: {
    notification: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    notificationDeliveryAttempt: { create: jest.Mock };
  };
  let auditService: jest.Mocked<AuditService>;
  let preferencesService: jest.Mocked<NotificationPreferencesService>;
  let templateService: jest.Mocked<NotificationTemplateService>;
  let service: NotificationCenterService;

  beforeEach(() => {
    prisma = {
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      notificationDeliveryAttempt: { create: jest.fn() },
    };
    auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditService>;
    preferencesService = {
      isEnabled: jest.fn().mockResolvedValue(true),
      list: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<NotificationPreferencesService>;
    templateService = {
      render: jest.fn(),
      renderTemplate: jest.fn(),
      list: jest.fn(),
      get: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<NotificationTemplateService>;
    service = new NotificationCenterService(
      prisma as unknown as PrismaService,
      auditService,
      preferencesService,
      templateService,
    );
  });

  it('skips send when preferences opt out', async () => {
    preferencesService.isEnabled.mockResolvedValue(false);

    const result = await service.send({
      userId,
      channel: NotificationChannel.EMAIL,
      type: NotificationType.PROMOTION,
      title: 'Sale',
      body: 'Save today',
    });

    expect(result).toEqual({
      notification: null,
      skipped: true,
      reason: 'preference_disabled',
    });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('queues and marks stubbed sends as sent', async () => {
    const queued = makeNotification(NotificationStatus.QUEUED);
    const sent = makeNotification(NotificationStatus.SENT, {
      sentAt: new Date(),
      retryCount: 1,
    });
    prisma.notification.create.mockResolvedValue(queued);
    prisma.notificationDeliveryAttempt.create.mockResolvedValue({});
    prisma.notification.update.mockResolvedValue(sent);

    const result = await service.send({
      userId,
      channel: NotificationChannel.IN_APP,
      type: NotificationType.WELCOME,
      title: 'Welcome',
      body: 'Hello',
    });

    expect(result.notification?.status).toBe(NotificationStatus.SENT);
    expect(prisma.notificationDeliveryAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        notificationId,
        attemptNumber: 1,
        status: NotificationStatus.SENT,
      }),
    });
  });

  it('moves exhausted retries to dead letter', async () => {
    const queued = makeNotification(NotificationStatus.QUEUED, { maxRetries: 1 });
    const dead = makeNotification(NotificationStatus.DEAD_LETTER, {
      maxRetries: 1,
      retryCount: 1,
      failureReason: 'provider down',
      deadLetteredAt: new Date(),
    });
    prisma.notification.create.mockResolvedValue(queued);
    prisma.notificationDeliveryAttempt.create.mockResolvedValue({});
    prisma.notification.update.mockResolvedValue(dead);
    jest
      .spyOn(
        service as unknown as { sendToChannel: () => Promise<Record<string, unknown>> },
        'sendToChannel',
      )
      .mockRejectedValue(new Error('provider down'));

    const result = await service.send({
      userId,
      channel: NotificationChannel.IN_APP,
      type: NotificationType.WELCOME,
      title: 'Welcome',
      body: 'Hello',
    });

    expect(result.notification?.status).toBe(NotificationStatus.DEAD_LETTER);
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: notificationId },
      data: expect.objectContaining({
        status: NotificationStatus.DEAD_LETTER,
        failureReason: 'provider down',
        retryCount: 1,
        deadLetteredAt: expect.any(Date),
      }),
    });
  });

  it('lists notifications with unread filters and pagination', async () => {
    prisma.notification.findMany.mockResolvedValue([]);
    prisma.notification.count.mockResolvedValue(0);

    await service.list(userId, { unreadOnly: true, page: 2, limit: 5 });

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId, deletedAt: null, readAt: null }),
        skip: 5,
        take: 5,
      }),
    );
  });

  it('marks one notification as read after owner check', async () => {
    const read = makeNotification(NotificationStatus.SENT, { readAt: new Date() });
    prisma.notification.findFirst.mockResolvedValue({ id: notificationId });
    prisma.notification.update.mockResolvedValue(read);

    await expect(service.markRead(userId, notificationId)).resolves.toBe(read);

    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: notificationId },
      data: { readAt: expect.any(Date) },
    });
  });

  it('marks all unread notifications as read', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 3 });

    await expect(service.markAllRead(userId)).resolves.toEqual({ updated: 3 });
  });

  it('broadcasts and counts skipped notifications', async () => {
    jest
      .spyOn(service, 'send')
      .mockResolvedValueOnce({
        notification: makeNotification(NotificationStatus.SENT, { id: 'n1' }),
        skipped: false,
      })
      .mockResolvedValueOnce({
        notification: null,
        skipped: true,
        reason: 'preference_disabled',
      });

    const result = await service.broadcast({
      userIds: [userId, '33333333-3333-4333-8333-333333333333'],
      channel: NotificationChannel.IN_APP,
      type: NotificationType.PROMOTION,
      title: 'Sale',
      body: 'Save today',
    });

    expect(result).toEqual({ sent: 1, skipped: 1, notificationIds: ['n1'] });
  });
});
