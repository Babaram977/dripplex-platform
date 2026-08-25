import { CmsContentStatus, CmsContentType } from '@prisma/client';

import {
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';

import { CMS_AUDIT_ACTIONS, CMS_PERMISSIONS } from './cms.constants';
import { toCmsContentDto } from './cms.mapper';
import { CmsService } from './cms.service';

import type { AuditService } from '../audit/audit.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { CmsContent, CmsContentVersion } from '@prisma/client';

const contentId = '11111111-1111-1111-1111-111111111111';
const adminId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const now = new Date('2026-07-21T12:00:00.000Z');

function cmsContent(overrides: Partial<CmsContent> = {}): CmsContent {
  return {
    id: contentId,
    type: CmsContentType.STATIC_PAGE,
    slug: 'about-us',
    title: 'About DrippleX',
    body: { blocks: [] },
    status: CmsContentStatus.DRAFT,
    version: 1,
    publishedAt: null,
    scheduledAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function cmsVersion(overrides: Partial<CmsContentVersion> = {}): CmsContentVersion {
  return {
    id: '22222222-2222-2222-2222-222222222222',
    contentId,
    version: 1,
    title: 'About DrippleX',
    body: { blocks: [] },
    createdBy: adminId,
    createdAt: now,
    ...overrides,
  };
}

describe('CmsService', () => {
  const prisma = {
    cmsContent: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    cmsContentVersion: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  const auditService = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditService>;

  const service = new CmsService(prisma, auditService);
  const context = { userId: adminId, ipAddress: '127.0.0.1' };

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation(
      (callback: (tx: PrismaService) => unknown) => callback(prisma),
    );
  });

  it('defines CMS permissions', () => {
    expect(CMS_PERMISSIONS.ADMIN_MANAGE).toBe('admin:cms:manage');
    expect(CMS_PERMISSIONS.CUSTOMER_READ).toBe('customer:cms:read');
  });

  it('creates draft content and an initial version', async () => {
    const created = cmsContent({ slug: 'home', title: 'Home' });
    (prisma.cmsContent.create as jest.Mock).mockResolvedValue(created);
    (prisma.cmsContentVersion.create as jest.Mock).mockResolvedValue(cmsVersion());

    const result = await service.createContent(
      {
        type: CmsContentType.STATIC_PAGE,
        slug: ' home ',
        title: 'Home',
        body: { hero: true },
      },
      context,
    );

    expect(result.status).toBe(CmsContentStatus.DRAFT);
    expect(prisma.cmsContent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: 'home', status: CmsContentStatus.DRAFT }),
      }),
    );
    expect(prisma.cmsContentVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ contentId: created.id, version: 1, createdBy: adminId }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      CMS_AUDIT_ACTIONS.CONTENT_CREATED,
      context,
      expect.objectContaining({ resourceId: created.id }),
    );
  });

  it('lists active contents with filters and pagination', async () => {
    (prisma.cmsContent.findMany as jest.Mock).mockResolvedValue([cmsContent()]);
    (prisma.cmsContent.count as jest.Mock).mockResolvedValue(1);

    const result = await service.listContents({
      type: CmsContentType.STATIC_PAGE,
      status: CmsContentStatus.DRAFT,
      page: 2,
      pageSize: 10,
    });

    expect(prisma.cmsContent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          type: CmsContentType.STATIC_PAGE,
          status: CmsContentStatus.DRAFT,
        },
        skip: 10,
        take: 10,
      }),
    );
    expect(result.meta.total).toBe(1);
  });

  it('gets a content record with versions', async () => {
    (prisma.cmsContent.findFirst as jest.Mock).mockResolvedValue({
      ...cmsContent(),
      versions: [cmsVersion({ version: 2 }), cmsVersion()],
    });

    const result = await service.getContent(contentId);

    expect(prisma.cmsContent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { versions: { orderBy: { version: 'desc' } } },
      }),
    );
    expect(result.versions).toHaveLength(2);
  });

  it('throws when admin content is not found', async () => {
    (prisma.cmsContent.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.getContent(contentId)).rejects.toBeInstanceOf(NotFoundDomainException);
  });

  it('updates content, increments version, and snapshots the update', async () => {
    (prisma.cmsContent.findFirst as jest.Mock).mockResolvedValue(cmsContent());
    (prisma.cmsContent.update as jest.Mock).mockResolvedValue(
      cmsContent({ title: 'Updated', version: 2 }),
    );
    (prisma.cmsContentVersion.create as jest.Mock).mockResolvedValue(cmsVersion({ version: 2 }));

    const result = await service.updateContent(contentId, { title: 'Updated' }, context);

    expect(result.version).toBe(2);
    expect(prisma.cmsContent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ title: 'Updated', version: 2 }) }),
    );
    expect(prisma.cmsContentVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ version: 2, title: 'Updated' }) }),
    );
  });

  it('allows update body to be cleared', async () => {
    (prisma.cmsContent.findFirst as jest.Mock).mockResolvedValue(cmsContent());
    (prisma.cmsContent.update as jest.Mock).mockResolvedValue(
      cmsContent({ body: null, version: 2 }),
    );
    (prisma.cmsContentVersion.create as jest.Mock).mockResolvedValue(
      cmsVersion({ body: null, version: 2 }),
    );

    await service.updateContent(contentId, { body: null }, context);

    expect(prisma.cmsContent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ body: expect.anything() }) }),
    );
  });

  it('rejects updates to missing content', async () => {
    (prisma.cmsContent.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.updateContent(contentId, { title: 'Nope' }, context),
    ).rejects.toBeInstanceOf(NotFoundDomainException);
  });

  it('publishes content and creates a publish version', async () => {
    (prisma.cmsContent.findFirst as jest.Mock).mockResolvedValue(cmsContent());
    (prisma.cmsContent.update as jest.Mock).mockResolvedValue(
      cmsContent({ status: CmsContentStatus.PUBLISHED, version: 2, publishedAt: now }),
    );
    (prisma.cmsContentVersion.create as jest.Mock).mockResolvedValue(cmsVersion({ version: 2 }));

    const result = await service.publishContent(contentId, context);

    expect(result.status).toBe(CmsContentStatus.PUBLISHED);
    expect(prisma.cmsContent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: CmsContentStatus.PUBLISHED,
          scheduledAt: null,
          version: 2,
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      CMS_AUDIT_ACTIONS.CONTENT_PUBLISHED,
      context,
      expect.any(Object),
    );
  });

  it('does not publish archived content', async () => {
    (prisma.cmsContent.findFirst as jest.Mock).mockResolvedValue(
      cmsContent({ status: CmsContentStatus.ARCHIVED }),
    );

    await expect(service.publishContent(contentId, context)).rejects.toBeInstanceOf(
      ValidationDomainException,
    );
  });

  it('schedules content for a future publish date', async () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    (prisma.cmsContent.findFirst as jest.Mock).mockResolvedValue(cmsContent());
    (prisma.cmsContent.update as jest.Mock).mockResolvedValue(
      cmsContent({ status: CmsContentStatus.SCHEDULED, version: 2, scheduledAt: new Date(future) }),
    );
    (prisma.cmsContentVersion.create as jest.Mock).mockResolvedValue(cmsVersion({ version: 2 }));

    const result = await service.scheduleContent(contentId, { scheduledAt: future }, context);

    expect(result.status).toBe(CmsContentStatus.SCHEDULED);
    expect(prisma.cmsContent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: CmsContentStatus.SCHEDULED, version: 2 }),
      }),
    );
  });

  it('rejects invalid schedule dates', async () => {
    (prisma.cmsContent.findFirst as jest.Mock).mockResolvedValue(cmsContent());

    await expect(
      service.scheduleContent(contentId, { scheduledAt: '2020-01-01T00:00:00.000Z' }, context),
    ).rejects.toBeInstanceOf(ValidationDomainException);
  });

  it('archives content without deleting it', async () => {
    (prisma.cmsContent.findFirst as jest.Mock).mockResolvedValue(cmsContent());
    (prisma.cmsContent.update as jest.Mock).mockResolvedValue(
      cmsContent({ status: CmsContentStatus.ARCHIVED }),
    );

    const result = await service.archiveContent(contentId, context);

    expect(result.status).toBe(CmsContentStatus.ARCHIVED);
    expect(result.deletedAt).toBeNull();
  });

  it('soft deletes content and archives it', async () => {
    const deletedAt = new Date('2026-07-21T13:00:00.000Z');
    (prisma.cmsContent.findFirst as jest.Mock).mockResolvedValue(cmsContent());
    (prisma.cmsContent.update as jest.Mock).mockResolvedValue(
      cmsContent({ status: CmsContentStatus.ARCHIVED, deletedAt }),
    );

    const result = await service.softDeleteContent(contentId, context);

    expect(result.status).toBe(CmsContentStatus.ARCHIVED);
    expect(result.deletedAt).toBe(deletedAt.toISOString());
  });

  it('gets published pages by slug', async () => {
    (prisma.cmsContent.findFirst as jest.Mock).mockResolvedValue(
      cmsContent({ status: CmsContentStatus.PUBLISHED }),
    );

    const result = await service.getPublishedPageBySlug('about-us');

    expect(result.slug).toBe('about-us');
    expect(prisma.cmsContent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          slug: 'about-us',
          status: CmsContentStatus.PUBLISHED,
          deletedAt: null,
        }),
      }),
    );
  });

  it('hides unpublished pages from public reads', async () => {
    (prisma.cmsContent.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.getPublishedPageBySlug('draft')).rejects.toBeInstanceOf(
      NotFoundDomainException,
    );
  });

  it('lists only published banner-like content', async () => {
    (prisma.cmsContent.findMany as jest.Mock).mockResolvedValue([
      cmsContent({ type: CmsContentType.HOMEPAGE_BANNER, status: CmsContentStatus.PUBLISHED }),
      cmsContent({ type: CmsContentType.PROMO_BANNER, status: CmsContentStatus.PUBLISHED }),
    ]);

    const result = await service.getPublishedBanners();

    expect(result).toHaveLength(2);
    expect(prisma.cmsContent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: CmsContentStatus.PUBLISHED,
          type: expect.objectContaining({
            in: expect.arrayContaining([
              CmsContentType.HOMEPAGE_BANNER,
              CmsContentType.PROMO_BANNER,
            ]),
          }),
        }),
      }),
    );
  });

  it('lists only published driver-help content', async () => {
    (prisma.cmsContent.findMany as jest.Mock).mockResolvedValue([
      cmsContent({ type: CmsContentType.DRIVER_FAQ, status: CmsContentStatus.PUBLISHED }),
      cmsContent({ type: CmsContentType.DRIVER_STATIC_PAGE, status: CmsContentStatus.PUBLISHED }),
    ]);

    const result = await service.getPublishedDriverHelp();

    expect(result).toHaveLength(2);
    expect(prisma.cmsContent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: CmsContentStatus.PUBLISHED,
          type: expect.objectContaining({
            in: expect.arrayContaining([
              CmsContentType.DRIVER_FAQ,
              CmsContentType.DRIVER_STATIC_PAGE,
            ]),
          }),
        }),
      }),
    );
  });

  it('resolves driver-help types by slug via the same published-page lookup', async () => {
    (prisma.cmsContent.findFirst as jest.Mock).mockResolvedValue(
      cmsContent({
        type: CmsContentType.DRIVER_FAQ,
        slug: 'how-do-payouts-work',
        status: CmsContentStatus.PUBLISHED,
      }),
    );

    const result = await service.getPublishedPageBySlug('how-do-payouts-work');

    expect(result.type).toBe(CmsContentType.DRIVER_FAQ);
    expect(prisma.cmsContent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: expect.objectContaining({
            in: expect.arrayContaining([
              CmsContentType.DRIVER_FAQ,
              CmsContentType.DRIVER_STATIC_PAGE,
            ]),
          }),
        }),
      }),
    );
  });

  it('maps nullable dates and versions safely', () => {
    const dto = toCmsContentDto({ ...cmsContent(), versions: [cmsVersion()] });

    expect(dto.publishedAt).toBeNull();
    expect(dto.versions[0]?.createdAt).toBe(now.toISOString());
  });
});
