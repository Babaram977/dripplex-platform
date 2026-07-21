import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { NotFoundDomainException } from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import type {
  CreateNotificationTemplateDto,
  UpdateNotificationTemplateDto,
} from './dto/notification-template.dto';
import type { NotificationTemplate } from '@prisma/client';

export interface RenderedNotificationTemplate {
  subject: string | null;
  body: string;
}

@Injectable()
export class NotificationTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  public list(): Promise<NotificationTemplate[]> {
    return this.prisma.notificationTemplate.findMany({
      where: { deletedAt: null },
      orderBy: [{ code: 'asc' }],
    });
  }

  public async get(code: string): Promise<NotificationTemplate> {
    const template = await this.prisma.notificationTemplate.findFirst({
      where: { code, deletedAt: null },
    });
    if (!template) {
      throw new NotFoundDomainException('Notification template not found', { code });
    }
    return template;
  }

  public create(dto: CreateNotificationTemplateDto): Promise<NotificationTemplate> {
    return this.prisma.notificationTemplate.create({
      data: {
        code: dto.code,
        channel: dto.channel,
        type: dto.type,
        subject: dto.subject ?? null,
        body: dto.body,
        locale: dto.locale ?? 'en',
        variables: (dto.variables ?? {}) as Prisma.InputJsonValue,
        active: dto.active ?? true,
      },
    });
  }

  public update(code: string, dto: UpdateNotificationTemplateDto): Promise<NotificationTemplate> {
    const data: Prisma.NotificationTemplateUpdateInput = {};

    if (dto.channel !== undefined) data.channel = dto.channel;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.subject !== undefined) data.subject = dto.subject;
    if (dto.body !== undefined) data.body = dto.body;
    if (dto.locale !== undefined) data.locale = dto.locale;
    if (dto.variables !== undefined) data.variables = dto.variables as Prisma.InputJsonValue;
    if (dto.active !== undefined) data.active = dto.active;
    data.deletedAt = null;

    return this.prisma.notificationTemplate.update({
      where: { code },
      data,
    });
  }

  public async delete(code: string): Promise<void> {
    await this.prisma.notificationTemplate.update({
      where: { code },
      data: { active: false, deletedAt: new Date() },
    });
  }

  public async render(
    code: string,
    variables: Record<string, unknown>,
  ): Promise<RenderedNotificationTemplate> {
    const template = await this.prisma.notificationTemplate.findFirst({
      where: { code, active: true, deletedAt: null },
    });
    if (!template) {
      throw new NotFoundDomainException('Notification template not found', { code });
    }

    return this.renderTemplate(template, variables);
  }

  public renderTemplate(
    template: Pick<NotificationTemplate, 'subject' | 'body'>,
    variables: Record<string, unknown>,
  ): RenderedNotificationTemplate {
    return {
      subject: template.subject ? this.interpolate(template.subject, variables) : null,
      body: this.interpolate(template.body, variables),
    };
  }

  private interpolate(value: string, variables: Record<string, unknown>): string {
    return value.replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (_match, key: string) => {
      const replacement = variables[key];
      if (replacement === undefined || replacement === null) return '';
      if (typeof replacement === 'string') return this.escapeHtml(replacement);
      if (typeof replacement === 'number' || typeof replacement === 'boolean') {
        return this.escapeHtml(replacement.toString());
      }
      if (typeof replacement === 'bigint') return this.escapeHtml(replacement.toString());
      if (typeof replacement === 'symbol') return this.escapeHtml(replacement.description ?? '');
      if (typeof replacement === 'object') return this.escapeHtml(JSON.stringify(replacement));
      return '';
    });
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
      switch (character) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case "'":
          return '&#39;';
        default:
          return character;
      }
    });
  }
}
