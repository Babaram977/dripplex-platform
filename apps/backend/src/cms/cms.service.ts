import { Injectable } from '@nestjs/common';
import { CmsContentStatus, CmsContentType, Prisma } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import { CMS_AUDIT_ACTIONS } from './cms.constants';
import { toCmsContentDto, toPaginatedCmsContents, toPrismaJson } from './cms.mapper';

import type {
  CmsContentDto,
  CmsContentListQuery,
  CreateCmsContentRequest,
  PaginatedResult,
  ScheduleCmsContentRequest,
  UpdateCmsContentRequest,
} from '@dripplex/types';

@Injectable()
export class CmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  public async createContent(
    dto: CreateCmsContentRequest,
    context: AuditContext,
  ): Promise<CmsContentDto> {
    const content = await this.prisma.$transaction(async (tx) => {
      const created = await tx.cmsContent.create({
        data: {
          type: dto.type,
          slug: dto.slug.trim(),
          title: dto.title.trim(),
          body: toPrismaJson(dto.body),
          status: CmsContentStatus.DRAFT,
          version: 1,
        },
      });
      await tx.cmsContentVersion.create({
        data: {
          contentId: created.id,
          version: created.version,
          title: created.title,
          body: toPrismaJson(created.body),
          ...(context.userId !== undefined ? { createdBy: context.userId } : {}),
        },
      });
      return created;
    });

    await this.auditService.record(CMS_AUDIT_ACTIONS.CONTENT_CREATED, context, {
      resource: 'cms_content',
      resourceId: content.id,
      metadata: { slug: content.slug, type: content.type },
    });

    return toCmsContentDto(content);
  }

  public async listContents(
    query: CmsContentListQuery = {},
  ): Promise<PaginatedResult<CmsContentDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.CmsContentWhereInput = { deletedAt: null };

    if (query.type !== undefined) {
      where.type = query.type;
    }
    if (query.status !== undefined) {
      where.status = query.status;
    }

    const [items, total] = await Promise.all([
      this.prisma.cmsContent.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.cmsContent.count({ where }),
    ]);

    return toPaginatedCmsContents(items, total, page, pageSize);
  }

  public async getContent(id: string): Promise<CmsContentDto> {
    const content = await this.prisma.cmsContent.findFirst({
      where: { id, deletedAt: null },
      include: { versions: { orderBy: { version: 'desc' } } },
    });
    if (!content) {
      throw new NotFoundDomainException('CMS content not found');
    }
    return toCmsContentDto(content);
  }

  public async updateContent(
    id: string,
    dto: UpdateCmsContentRequest,
    context: AuditContext,
  ): Promise<CmsContentDto> {
    const existing = await this.requireMutableContent(id);
    const nextVersion = existing.version + 1;
    const data: Prisma.CmsContentUpdateInput = { version: nextVersion };

    if (dto.type !== undefined) {
      data.type = dto.type;
    }
    if (dto.slug !== undefined) {
      data.slug = dto.slug.trim();
    }
    if (dto.title !== undefined) {
      data.title = dto.title.trim();
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'body')) {
      data.body = toPrismaJson(dto.body);
    }

    const content = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.cmsContent.update({
        where: { id },
        data,
      });
      await tx.cmsContentVersion.create({
        data: {
          contentId: updated.id,
          version: updated.version,
          title: updated.title,
          body: toPrismaJson(updated.body),
          ...(context.userId !== undefined ? { createdBy: context.userId } : {}),
        },
      });
      return updated;
    });

    await this.auditService.record(CMS_AUDIT_ACTIONS.CONTENT_UPDATED, context, {
      resource: 'cms_content',
      resourceId: content.id,
      metadata: { previousVersion: existing.version, version: content.version },
    });

    return toCmsContentDto(content);
  }

  public async publishContent(id: string, context: AuditContext): Promise<CmsContentDto> {
    const existing = await this.requireMutableContent(id);
    if (existing.status === CmsContentStatus.ARCHIVED) {
      throw new ValidationDomainException('Archived content cannot be published');
    }

    const content = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.cmsContent.update({
        where: { id },
        data: {
          status: CmsContentStatus.PUBLISHED,
          publishedAt: new Date(),
          scheduledAt: null,
          version: existing.version + 1,
        },
      });
      await tx.cmsContentVersion.create({
        data: {
          contentId: updated.id,
          version: updated.version,
          title: updated.title,
          body: toPrismaJson(updated.body),
          ...(context.userId !== undefined ? { createdBy: context.userId } : {}),
        },
      });
      return updated;
    });

    await this.auditService.record(CMS_AUDIT_ACTIONS.CONTENT_PUBLISHED, context, {
      resource: 'cms_content',
      resourceId: content.id,
      metadata: { slug: content.slug, version: content.version },
    });

    return toCmsContentDto(content);
  }

  public async scheduleContent(
    id: string,
    dto: ScheduleCmsContentRequest,
    context: AuditContext,
  ): Promise<CmsContentDto> {
    const existing = await this.requireMutableContent(id);
    if (existing.status === CmsContentStatus.ARCHIVED) {
      throw new ValidationDomainException('Archived content cannot be scheduled');
    }
    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
      throw new ValidationDomainException('scheduledAt must be a future ISO date');
    }

    const content = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.cmsContent.update({
        where: { id },
        data: {
          status: CmsContentStatus.SCHEDULED,
          scheduledAt,
          publishedAt: null,
          version: existing.version + 1,
        },
      });
      await tx.cmsContentVersion.create({
        data: {
          contentId: updated.id,
          version: updated.version,
          title: updated.title,
          body: toPrismaJson(updated.body),
          ...(context.userId !== undefined ? { createdBy: context.userId } : {}),
        },
      });
      return updated;
    });

    await this.auditService.record(CMS_AUDIT_ACTIONS.CONTENT_SCHEDULED, context, {
      resource: 'cms_content',
      resourceId: content.id,
      metadata: { scheduledAt: scheduledAt.toISOString(), version: content.version },
    });

    return toCmsContentDto(content);
  }

  public async archiveContent(id: string, context: AuditContext): Promise<CmsContentDto> {
    await this.requireMutableContent(id);
    const content = await this.prisma.cmsContent.update({
      where: { id },
      data: {
        status: CmsContentStatus.ARCHIVED,
        scheduledAt: null,
      },
    });

    await this.auditService.record(CMS_AUDIT_ACTIONS.CONTENT_ARCHIVED, context, {
      resource: 'cms_content',
      resourceId: content.id,
    });

    return toCmsContentDto(content);
  }

  public async softDeleteContent(id: string, context: AuditContext): Promise<CmsContentDto> {
    await this.requireMutableContent(id);
    const content = await this.prisma.cmsContent.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: CmsContentStatus.ARCHIVED,
        scheduledAt: null,
      },
    });

    await this.auditService.record(CMS_AUDIT_ACTIONS.CONTENT_DELETED, context, {
      resource: 'cms_content',
      resourceId: content.id,
    });

    return toCmsContentDto(content);
  }

  public async getPublishedPageBySlug(slug: string): Promise<CmsContentDto> {
    const content = await this.prisma.cmsContent.findFirst({
      where: {
        slug,
        deletedAt: null,
        status: CmsContentStatus.PUBLISHED,
        type: {
          in: [
            CmsContentType.STATIC_PAGE,
            CmsContentType.LANDING_PAGE,
            CmsContentType.FAQ,
            CmsContentType.DRIVER_STATIC_PAGE,
            CmsContentType.DRIVER_FAQ,
          ],
        },
      },
    });
    if (!content) {
      throw new NotFoundDomainException('CMS page not found');
    }
    return toCmsContentDto(content);
  }

  /** Driver Slice 2 item 7 — Help Centre: all published driver-scoped
   * content (FAQ entries + full articles), for the driver-portal browse
   * list. FAQs first (title, then most-recently-published), then pages. */
  public async getPublishedDriverHelp(): Promise<CmsContentDto[]> {
    const contents = await this.prisma.cmsContent.findMany({
      where: {
        deletedAt: null,
        status: CmsContentStatus.PUBLISHED,
        type: { in: [CmsContentType.DRIVER_FAQ, CmsContentType.DRIVER_STATIC_PAGE] },
      },
      orderBy: [{ type: 'asc' }, { title: 'asc' }],
    });
    return contents.map((content) => toCmsContentDto(content));
  }

  public async getPublishedBanners(): Promise<CmsContentDto[]> {
    const contents = await this.prisma.cmsContent.findMany({
      where: {
        deletedAt: null,
        status: CmsContentStatus.PUBLISHED,
        type: {
          in: [
            CmsContentType.HOMEPAGE_BANNER,
            CmsContentType.PROMO_BANNER,
            CmsContentType.ANNOUNCEMENT,
            CmsContentType.MARKETING_BLOCK,
          ],
        },
      },
      orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
    });
    return contents.map((content) => toCmsContentDto(content));
  }

  private async requireMutableContent(id: string): Promise<{
    id: string;
    status: CmsContentStatus;
    version: number;
  }> {
    const content = await this.prisma.cmsContent.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true, version: true },
    });
    if (!content) {
      throw new NotFoundDomainException('CMS content not found');
    }
    return content;
  }
}
