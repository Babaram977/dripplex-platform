import { NotificationChannel, NotificationType } from '@prisma/client';

import { NotificationPreferencesService } from './notification-preferences.service';

import type { PrismaService } from '../prisma/prisma.service';

describe('NotificationPreferencesService', () => {
  let prisma: {
    notificationPreference: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
  };
  let service: NotificationPreferencesService;

  beforeEach(() => {
    prisma = {
      notificationPreference: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };
    service = new NotificationPreferencesService(prisma as unknown as PrismaService);
  });

  it('defaults missing preferences to enabled', async () => {
    prisma.notificationPreference.findUnique.mockResolvedValue(null);

    await expect(
      service.isEnabled('user-1', NotificationChannel.IN_APP, NotificationType.WELCOME),
    ).resolves.toBe(true);
  });

  it('returns false when an active preference is disabled', async () => {
    prisma.notificationPreference.findUnique.mockResolvedValue({
      enabled: false,
      deletedAt: null,
    });

    await expect(
      service.isEnabled('user-1', NotificationChannel.EMAIL, NotificationType.PROMOTION),
    ).resolves.toBe(false);
  });

  it('upserts preferences and returns the current list', async () => {
    await service.update('user-1', [
      {
        channel: NotificationChannel.EMAIL,
        type: NotificationType.PROMOTION,
        enabled: false,
      },
    ]);

    expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_channel_type: {
            userId: 'user-1',
            channel: NotificationChannel.EMAIL,
            type: NotificationType.PROMOTION,
          },
        },
      }),
    );
    expect(prisma.notificationPreference.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', deletedAt: null },
      orderBy: [{ channel: 'asc' }, { type: 'asc' }],
    });
  });
});
