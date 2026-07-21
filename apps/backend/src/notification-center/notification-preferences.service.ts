import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import type { NotificationPreferenceItemDto } from './dto/notification-preference.dto';
import type { NotificationChannel, NotificationPreference, NotificationType } from '@prisma/client';

@Injectable()
export class NotificationPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  public list(userId: string): Promise<NotificationPreference[]> {
    return this.prisma.notificationPreference.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ channel: 'asc' }, { type: 'asc' }],
    });
  }

  public async update(
    userId: string,
    preferences: NotificationPreferenceItemDto[],
  ): Promise<NotificationPreference[]> {
    await Promise.all(
      preferences.map((preference) =>
        this.prisma.notificationPreference.upsert({
          where: {
            userId_channel_type: {
              userId,
              channel: preference.channel,
              type: preference.type,
            },
          },
          create: {
            userId,
            channel: preference.channel,
            type: preference.type,
            enabled: preference.enabled,
          },
          update: {
            enabled: preference.enabled,
            deletedAt: null,
          },
        }),
      ),
    );

    return await this.list(userId);
  }

  public async isEnabled(
    userId: string,
    channel: NotificationChannel,
    type: NotificationType,
  ): Promise<boolean> {
    const preference = await this.prisma.notificationPreference.findUnique({
      where: {
        userId_channel_type: {
          userId,
          channel,
          type,
        },
      },
    });

    return preference?.deletedAt === null || preference === null
      ? (preference?.enabled ?? true)
      : true;
  }
}
