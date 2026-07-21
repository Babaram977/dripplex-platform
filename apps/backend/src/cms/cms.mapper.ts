import { Prisma } from '@prisma/client';

import type { CmsContentDto, CmsContentVersionDto, PaginatedResult } from '@dripplex/types';
import type { CmsContent, CmsContentVersion } from '@prisma/client';

function nullableDate(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function toCmsContentVersionDto(version: CmsContentVersion): CmsContentVersionDto {
  return {
    id: version.id,
    contentId: version.contentId,
    version: version.version,
    title: version.title,
    body: version.body,
    createdBy: version.createdBy,
    createdAt: version.createdAt.toISOString(),
  };
}

export function toCmsContentDto(
  content: CmsContent & { versions?: CmsContentVersion[] },
): CmsContentDto {
  return {
    id: content.id,
    type: content.type,
    slug: content.slug,
    title: content.title,
    body: content.body,
    status: content.status,
    version: content.version,
    publishedAt: nullableDate(content.publishedAt),
    scheduledAt: nullableDate(content.scheduledAt),
    createdAt: content.createdAt.toISOString(),
    updatedAt: content.updatedAt.toISOString(),
    deletedAt: nullableDate(content.deletedAt),
    versions: (content.versions ?? []).map(toCmsContentVersionDto),
  };
}

export function toPaginatedCmsContents(
  items: CmsContent[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<CmsContentDto> {
  return {
    items: items.map((item) => toCmsContentDto(item)),
    meta: {
      page,
      limit: pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export function toPrismaJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) {
    return Prisma.JsonNull;
  }
  return value;
}
