import { Inject, Injectable } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  Prisma,
} from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import { NotFoundDomainException } from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import { NOTIFICATION_CENTER_AUDIT_ACTIONS } from './notification-center.constants';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationTemplateService } from './notification-template.service';
import {
  EMAIL_PROVIDER,
  PUSH_PROVIDER,
  SMS_PROVIDER,
  type NotificationProvider,
  type NotificationProviderResult,
} from './providers/notification-provider';

import type { UpdateNotificationPreferencesDto } from './dto/notification-preference.dto';
import type {
  CreateNotificationTemplateDto,
  UpdateNotificationTemplateDto,
} from './dto/notification-template.dto';
import type {
  BroadcastNotificationDto,
  CreateNotificationDto,
  ListNotificationsQueryDto,
} from './dto/notification.dto';
import type {
  Notification,
  NotificationDeliveryAttempt,
  NotificationPreference,
  NotificationTemplate,
} from '@prisma/client';

export interface NotificationListResult {
  items: Notification[];
  total: number;
  page: number;
  limit: number;
}

export interface SendNotificationResult {
  notification: Notification | null;
  skipped: boolean;
  reason?: string;
}

export interface BroadcastNotificationResult {
  sent: number;
  skipped: number;
  notificationIds: string[];
}

type NotificationRequest = Omit<CreateNotificationDto, 'priority'> & {
  priority?: NotificationPriority;
};

@Injectable()
export class NotificationCenterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly preferencesService: NotificationPreferencesService,
    private readonly templateService: NotificationTemplateService,
    @Inject(PUSH_PROVIDER) private readonly pushProvider: NotificationProvider,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: NotificationProvider,
    @Inject(SMS_PROVIDER) private readonly smsProvider: NotificationProvider,
  ) {}

  public async create(
    dto: CreateNotificationDto,
    context: AuditContext = {},
  ): Promise<Notification> {
    const notification = await this.prisma.notification.create({
      data: this.toCreateData(dto, NotificationStatus.PENDING),
    });

    await this.auditService.record(NOTIFICATION_CENTER_AUDIT_ACTIONS.CREATED, context, {
      resource: 'notification',
      resourceId: notification.id,
      userId: notification.userId,
      metadata: { channel: notification.channel, type: notification.type },
    });

    return notification;
  }

  public async send(
    dto: NotificationRequest,
    context: AuditContext = {},
  ): Promise<SendNotificationResult> {
    const enabled = await this.preferencesService.isEnabled(dto.userId, dto.channel, dto.type);
    if (!enabled) {
      return { notification: null, skipped: true, reason: 'preference_disabled' };
    }

    const renderedDto = await this.applyTemplate(dto);
    const notification = await this.prisma.notification.create({
      data: this.toCreateData(renderedDto, NotificationStatus.QUEUED),
    });

    await this.auditService.record(NOTIFICATION_CENTER_AUDIT_ACTIONS.CREATED, context, {
      resource: 'notification',
      resourceId: notification.id,
      userId: notification.userId,
      metadata: { channel: notification.channel, type: notification.type, queued: true },
    });

    const delivered = await this.attemptDelivery(notification, context);
    return { notification: delivered, skipped: false };
  }

  public async list(
    userId: string,
    query: ListNotificationsQueryDto = {},
  ): Promise<NotificationListResult> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.NotificationWhereInput = {
      userId,
      deletedAt: null,
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.category !== undefined ? { category: query.category } : {}),
      ...(query.channel !== undefined ? { channel: query.channel } : {}),
      ...(query.type !== undefined ? { type: query.type } : {}),
      ...(query.unreadOnly === true ? { readAt: null } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  public async markRead(
    userId: string,
    notificationId: string,
    context: AuditContext = {},
  ): Promise<Notification> {
    await this.assertNotificationOwner(userId, notificationId);
    const notification = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });

    await this.auditService.record(NOTIFICATION_CENTER_AUDIT_ACTIONS.READ, context, {
      resource: 'notification',
      resourceId: notification.id,
      userId,
    });

    return notification;
  }

  public async markAllRead(
    userId: string,
    context: AuditContext = {},
  ): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, deletedAt: null, readAt: null },
      data: { readAt: new Date() },
    });

    await this.auditService.record(NOTIFICATION_CENTER_AUDIT_ACTIONS.READ_ALL, context, {
      resource: 'notification',
      userId,
      metadata: { updated: result.count },
    });

    return { updated: result.count };
  }

  public async delete(
    userId: string,
    notificationId: string,
    context: AuditContext = {},
  ): Promise<void> {
    await this.assertNotificationOwner(userId, notificationId);
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { deletedAt: new Date() },
    });

    await this.auditService.record(NOTIFICATION_CENTER_AUDIT_ACTIONS.DELETED, context, {
      resource: 'notification',
      resourceId: notificationId,
      userId,
    });
  }

  public listPreferences(userId: string): Promise<NotificationPreference[]> {
    return this.preferencesService.list(userId);
  }

  public async updatePreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
    context: AuditContext = {},
  ): Promise<NotificationPreference[]> {
    const preferences = await this.preferencesService.update(userId, dto.preferences);
    await this.auditService.record(NOTIFICATION_CENTER_AUDIT_ACTIONS.PREFERENCES_UPDATED, context, {
      resource: 'notification_preference',
      userId,
      metadata: { count: dto.preferences.length },
    });
    return preferences;
  }

  public listTemplates(): Promise<NotificationTemplate[]> {
    return this.templateService.list();
  }

  public getTemplate(code: string): Promise<NotificationTemplate> {
    return this.templateService.get(code);
  }

  public async createTemplate(
    dto: CreateNotificationTemplateDto,
    context: AuditContext = {},
  ): Promise<NotificationTemplate> {
    const template = await this.templateService.create(dto);
    await this.auditService.record(NOTIFICATION_CENTER_AUDIT_ACTIONS.TEMPLATE_CREATED, context, {
      resource: 'notification_template',
      resourceId: template.id,
      metadata: { code: template.code },
    });
    return template;
  }

  public async updateTemplate(
    code: string,
    dto: UpdateNotificationTemplateDto,
    context: AuditContext = {},
  ): Promise<NotificationTemplate> {
    const template = await this.templateService.update(code, dto);
    await this.auditService.record(NOTIFICATION_CENTER_AUDIT_ACTIONS.TEMPLATE_UPDATED, context, {
      resource: 'notification_template',
      resourceId: template.id,
      metadata: { code },
    });
    return template;
  }

  public async deleteTemplate(code: string, context: AuditContext = {}): Promise<void> {
    await this.templateService.delete(code);
    await this.auditService.record(NOTIFICATION_CENTER_AUDIT_ACTIONS.TEMPLATE_DELETED, context, {
      resource: 'notification_template',
      metadata: { code },
    });
  }

  public renderTemplate(
    template: Pick<NotificationTemplate, 'subject' | 'body'>,
    variables: Record<string, unknown>,
  ): { subject: string | null; body: string } {
    return this.templateService.renderTemplate(template, variables);
  }

  public async broadcast(
    dto: BroadcastNotificationDto,
    context: AuditContext = {},
  ): Promise<BroadcastNotificationResult> {
    const results = await Promise.all(
      dto.userIds.map((userId) => {
        const request: NotificationRequest = {
          userId,
          category: dto.category,
          channel: dto.channel,
          type: dto.type,
          title: dto.title,
          body: dto.body,
          ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
          ...(dto.templateCode !== undefined ? { templateCode: dto.templateCode } : {}),
          ...(dto.payload !== undefined ? { payload: dto.payload } : {}),
          ...(dto.expiresAt !== undefined ? { expiresAt: dto.expiresAt } : {}),
        };
        return this.send(request, context);
      }),
    );
    const notificationIds = results
      .map((result) => result.notification?.id)
      .filter((id): id is string => id !== undefined);

    await this.auditService.record(NOTIFICATION_CENTER_AUDIT_ACTIONS.BROADCAST, context, {
      resource: 'notification',
      metadata: {
        requested: dto.userIds.length,
        sent: notificationIds.length,
        skipped: results.filter((result) => result.skipped).length,
      },
    });

    return {
      sent: notificationIds.length,
      skipped: results.filter((result) => result.skipped).length,
      notificationIds,
    };
  }

  public async resend(notificationId: string, context: AuditContext = {}): Promise<Notification> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, deletedAt: null },
    });
    if (!notification) {
      throw new NotFoundDomainException('Notification not found', { notificationId });
    }

    const delivered = await this.attemptDelivery(notification, context);
    await this.auditService.record(NOTIFICATION_CENTER_AUDIT_ACTIONS.RESENT, context, {
      resource: 'notification',
      resourceId: notification.id,
      userId: notification.userId,
      metadata: { status: delivered.status },
    });
    return delivered;
  }

  private async attemptDelivery(
    notification: Notification,
    context: AuditContext,
  ): Promise<Notification> {
    const attemptNumber = notification.retryCount + 1;
    try {
      const response = await this.sendToChannel(notification);
      if (!response.configured) {
        // Not a transient failure — no provider is wired for this channel
        // yet (Phase D). Retrying will never succeed, so this goes
        // straight to a terminal state on the first attempt instead of
        // burning through maxRetries for something retrying can't fix.
        return await this.recordUndeliverable(notification, attemptNumber, response, context);
      }
      await this.createAttempt(
        notification.id,
        attemptNumber,
        NotificationStatus.SENT,
        response as unknown as Record<string, unknown>,
      );
      const delivered = await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
          failureReason: null,
          retryCount: attemptNumber,
        },
      });
      await this.auditService.record(NOTIFICATION_CENTER_AUDIT_ACTIONS.SENT, context, {
        resource: 'notification',
        resourceId: notification.id,
        userId: notification.userId,
        metadata: { channel: notification.channel, attemptNumber },
      });
      return delivered;
    } catch (error) {
      const failureReason = error instanceof Error ? error.message : 'Unknown notification error';
      await this.createAttempt(
        notification.id,
        attemptNumber,
        NotificationStatus.FAILED,
        undefined,
        failureReason,
      );
      const deadLettered = attemptNumber >= notification.maxRetries;
      const failed = await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: deadLettered ? NotificationStatus.DEAD_LETTER : NotificationStatus.FAILED,
          failureReason,
          retryCount: attemptNumber,
          ...(deadLettered ? { deadLetteredAt: new Date() } : {}),
        },
      });

      if (deadLettered) {
        await this.auditService.record(NOTIFICATION_CENTER_AUDIT_ACTIONS.DEAD_LETTERED, context, {
          resource: 'notification',
          resourceId: notification.id,
          userId: notification.userId,
          metadata: { failureReason, attemptNumber },
        });
      }

      return failed;
    }
  }

  private async createAttempt(
    notificationId: string,
    attemptNumber: number,
    status: NotificationStatus,
    providerResponse?: Record<string, unknown>,
    error?: string,
  ): Promise<NotificationDeliveryAttempt> {
    return await this.prisma.notificationDeliveryAttempt.create({
      data: {
        notificationId,
        attemptNumber,
        status,
        ...(providerResponse !== undefined
          ? { providerResponse: providerResponse as Prisma.InputJsonValue }
          : {}),
        ...(error !== undefined ? { error } : {}),
      },
    });
  }

  private async applyTemplate(dto: NotificationRequest): Promise<NotificationRequest> {
    if (!dto.templateCode) {
      return dto;
    }

    const rendered = await this.templateService.render(dto.templateCode, dto.payload ?? {});
    return {
      ...dto,
      title: rendered.subject ?? dto.title,
      body: rendered.body,
    };
  }

  private toCreateData(
    dto: NotificationRequest,
    status: NotificationStatus,
  ): Prisma.NotificationUncheckedCreateInput {
    return {
      userId: dto.userId,
      category: dto.category,
      channel: dto.channel,
      type: dto.type,
      priority: dto.priority ?? NotificationPriority.NORMAL,
      status,
      title: dto.title,
      body: dto.body,
      ...(dto.templateCode !== undefined ? { templateCode: dto.templateCode } : {}),
      ...(dto.payload !== undefined ? { payload: dto.payload as Prisma.InputJsonValue } : {}),
      ...(dto.scheduledAt !== undefined ? { scheduledAt: dto.scheduledAt } : {}),
      ...(dto.expiresAt !== undefined ? { expiresAt: dto.expiresAt } : {}),
    };
  }

  private async assertNotificationOwner(userId: string, notificationId: string): Promise<void> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!notification) {
      throw new NotFoundDomainException('Notification not found', { notificationId });
    }
  }

  private async recordUndeliverable(
    notification: Notification,
    attemptNumber: number,
    response: NotificationProviderResult,
    context: AuditContext,
  ): Promise<Notification> {
    const failureReason = `No provider configured for ${notification.channel} (${response.provider})`;
    await this.createAttempt(
      notification.id,
      attemptNumber,
      NotificationStatus.DEAD_LETTER,
      response as unknown as Record<string, unknown>,
      failureReason,
    );
    const failed = await this.prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: NotificationStatus.DEAD_LETTER,
        failureReason,
        retryCount: attemptNumber,
        deadLetteredAt: new Date(),
      },
    });
    await this.auditService.record(NOTIFICATION_CENTER_AUDIT_ACTIONS.DEAD_LETTERED, context, {
      resource: 'notification',
      resourceId: notification.id,
      userId: notification.userId,
      metadata: { failureReason, attemptNumber, reason: 'not_configured' },
    });
    return failed;
  }

  /**
   * IN_APP has no external delivery step — the persisted row itself is the
   * "delivery" (it's what GET /customer/notifications reads), so it always
   * succeeds. Every other channel goes through its provider adapter, which
   * is honest about being unconfigured rather than pretending to send.
   * WHATSAPP has no dedicated adapter yet (no real usage anywhere in the
   * codebase to build one against) — it reuses the same "not configured"
   * shape as the other unconfigured channels until a real WhatsApp
   * integration is a genuine requirement, not a speculative one.
   */
  private sendToChannel(notification: Notification): Promise<NotificationProviderResult> {
    switch (notification.channel) {
      case NotificationChannel.IN_APP:
        return Promise.resolve({ configured: true, provider: 'in_app' });
      case NotificationChannel.PUSH:
        return this.pushProvider.send(notification);
      case NotificationChannel.EMAIL:
        return this.emailProvider.send(notification);
      case NotificationChannel.SMS:
        return this.smsProvider.send(notification);
      case NotificationChannel.WHATSAPP:
        return Promise.resolve({ configured: false, provider: 'whatsapp' });
    }
  }
}
