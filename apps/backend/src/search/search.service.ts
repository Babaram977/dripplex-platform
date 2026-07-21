import { Injectable } from '@nestjs/common';
import { Prisma, SearchEntityType } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

import { SEARCH_AUDIT_ACTIONS } from './search.constants';

import type { SearchQueryDto, SearchSort } from './dto/search-query.dto';
import type { UpsertSearchDocumentDto } from './dto/upsert-search-document.dto';
import type { PopularSearch, RecentSearch, SearchDocument } from '@prisma/client';

export type SearchDocumentResult = SearchDocument & { relevanceScore: number };

export interface SearchResult {
  items: SearchDocumentResult[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  public async search(
    query: SearchQueryDto,
    userId?: string,
    context: AuditContext = {},
  ): Promise<SearchResult> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const term = this.normalizeQuery(query.q);
    const where = this.buildWhere(query, term);

    const [documents, total] = await Promise.all([
      this.prisma.searchDocument.findMany({
        where,
        orderBy: this.sortOrder(query.sort ?? 'relevance'),
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.searchDocument.count({ where }),
    ]);

    if (term) {
      await this.recordQuery(term, total, userId, context);
    }

    return {
      items: documents.map((document) => ({
        ...document,
        relevanceScore: this.rankDocument(document, term),
      })),
      total,
      page,
      limit,
    };
  }

  public async autocomplete(q: string, type?: SearchEntityType, limit = 10): Promise<string[]> {
    const term = this.normalizeQuery(q);
    if (!term) {
      return [];
    }

    const documents = await this.prisma.searchDocument.findMany({
      where: {
        deletedAt: null,
        ...(type !== undefined ? { entityType: type } : {}),
        OR: [
          { title: { startsWith: term, mode: 'insensitive' } },
          { subtitle: { startsWith: term, mode: 'insensitive' } },
          { title: { contains: term, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ rankingScore: 'desc' }, { title: 'asc' }],
      take: limit * 2,
    });

    const suggestions = new Set<string>();
    for (const document of documents) {
      [document.title, document.subtitle, ...document.keywords].forEach((candidate) => {
        if (
          candidate &&
          candidate.toLowerCase().includes(term.toLowerCase()) &&
          suggestions.size < limit
        ) {
          suggestions.add(candidate);
        }
      });
    }

    return [...suggestions];
  }

  public async suggestions(q?: string, limit = 10): Promise<string[]> {
    const term = this.normalizeQuery(q);
    const where: Prisma.PopularSearchWhereInput | undefined = term
      ? { query: { contains: term, mode: 'insensitive' } }
      : undefined;
    const popular = await this.prisma.popularSearch.findMany({
      ...(where !== undefined ? { where } : {}),
      orderBy: [{ hitCount: 'desc' }, { updatedAt: 'desc' }],
      take: limit,
    });
    return popular.map((item) => item.query);
  }

  public popular(limit = 10): Promise<PopularSearch[]> {
    return this.prisma.popularSearch.findMany({
      orderBy: [{ hitCount: 'desc' }, { updatedAt: 'desc' }],
      take: limit,
    });
  }

  public async recent(userId: string, limit = 10): Promise<RecentSearch[]> {
    const rows = await this.prisma.recentSearch.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }],
      take: limit * 2,
    });

    const seen = new Set<string>();
    return rows.filter((row) => {
      if (seen.has(row.query) || seen.size >= limit) {
        return false;
      }
      seen.add(row.query);
      return true;
    });
  }

  public async upsertDocument(
    dto: UpsertSearchDocumentDto,
    context: AuditContext = {},
  ): Promise<SearchDocument> {
    const document = await this.prisma.searchDocument.upsert({
      where: {
        entityType_entityId: {
          entityType: dto.entityType,
          entityId: dto.entityId,
        },
      },
      create: this.toCreateInput(dto),
      update: this.toUpdateInput(dto),
    });

    await this.auditService.record(SEARCH_AUDIT_ACTIONS.DOCUMENT_UPSERTED, context, {
      resource: 'search_document',
      resourceId: document.id,
      metadata: { entityType: document.entityType, entityId: document.entityId },
    });

    return document;
  }

  public rankDocument(document: SearchDocument, query?: string): number {
    const term = this.normalizeQuery(query);
    const title = document.title.toLowerCase();
    const subtitle = document.subtitle?.toLowerCase() ?? '';
    const description = document.description?.toLowerCase() ?? '';
    const keywords = document.keywords.map((keyword) => keyword.toLowerCase());
    let score = document.rankingScore;

    if (term) {
      const lowerTerm = term.toLowerCase();
      if (title === lowerTerm) score += 50;
      if (title.startsWith(lowerTerm)) score += 25;
      if (title.includes(lowerTerm)) score += 10;
      if (subtitle.includes(lowerTerm)) score += 5;
      if (description.includes(lowerTerm)) score += 3;
      if (keywords.includes(lowerTerm)) score += 8;
    }

    if (document.available) score += 2;
    if (document.rating !== null) score += document.rating;
    return score;
  }

  private buildWhere(query: SearchQueryDto, term: string): Prisma.SearchDocumentWhereInput {
    const and: Prisma.SearchDocumentWhereInput[] = [{ deletedAt: null }];

    if (query.type !== undefined) and.push({ entityType: query.type });
    if (query.available !== undefined) and.push({ available: query.available });
    if (query.merchantId !== undefined) and.push({ merchantId: query.merchantId });
    if (query.categoryId !== undefined) and.push({ categoryId: query.categoryId });
    if (query.minRating !== undefined) and.push({ rating: { gte: query.minRating } });

    const price: Prisma.DecimalNullableFilter = {};
    if (query.minPrice !== undefined) price.gte = query.minPrice;
    if (query.maxPrice !== undefined) price.lte = query.maxPrice;
    if (Object.keys(price).length > 0) and.push({ price });

    if (term) {
      and.push({
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { subtitle: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { keywords: { has: term } },
        ],
      });
    }

    return { AND: and };
  }

  private sortOrder(sort: SearchSort): Prisma.SearchDocumentOrderByWithRelationInput[] {
    switch (sort) {
      case 'price_asc':
        return [{ price: 'asc' }, { rankingScore: 'desc' }];
      case 'price_desc':
        return [{ price: 'desc' }, { rankingScore: 'desc' }];
      case 'rating_desc':
        return [{ rating: 'desc' }, { rankingScore: 'desc' }];
      case 'newest':
        return [{ createdAt: 'desc' }];
      case 'relevance':
      default:
        return [{ rankingScore: 'desc' }, { updatedAt: 'desc' }];
    }
  }

  private async recordQuery(
    query: string,
    resultCount: number,
    userId?: string,
    context: AuditContext = {},
  ): Promise<void> {
    await Promise.all([
      this.prisma.searchQueryLog.create({
        data: {
          query,
          resultCount,
          ...(userId !== undefined ? { userId } : {}),
        },
      }),
      this.prisma.popularSearch.upsert({
        where: { query },
        create: { query, hitCount: 1 },
        update: { hitCount: { increment: 1 } },
      }),
      ...(userId !== undefined
        ? [
            this.prisma.recentSearch.create({
              data: { userId, query },
            }),
          ]
        : []),
    ]);

    await this.auditService.record(SEARCH_AUDIT_ACTIONS.QUERY, context, {
      resource: 'search',
      metadata: { query, resultCount },
      ...(userId !== undefined ? { userId } : {}),
    });
  }

  private toCreateInput(dto: UpsertSearchDocumentDto): Prisma.SearchDocumentUncheckedCreateInput {
    return {
      entityType: dto.entityType,
      entityId: dto.entityId,
      title: dto.title,
      keywords: dto.keywords ?? [],
      rankingScore: dto.rankingScore ?? 0,
      available: dto.available ?? true,
      ...(dto.subtitle !== undefined ? { subtitle: dto.subtitle } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.metadata !== undefined ? { metadata: dto.metadata as Prisma.InputJsonValue } : {}),
      ...(dto.price !== undefined ? { price: dto.price } : {}),
      ...(dto.rating !== undefined ? { rating: dto.rating } : {}),
      ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
      ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
      ...(dto.merchantId !== undefined ? { merchantId: dto.merchantId } : {}),
      ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
      ...(dto.brandId !== undefined ? { brandId: dto.brandId } : {}),
    };
  }

  private toUpdateInput(dto: UpsertSearchDocumentDto): Prisma.SearchDocumentUncheckedUpdateInput {
    return {
      title: dto.title,
      keywords: dto.keywords ?? [],
      rankingScore: dto.rankingScore ?? 0,
      available: dto.available ?? true,
      deletedAt: null,
      ...(dto.subtitle !== undefined ? { subtitle: dto.subtitle } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.metadata !== undefined ? { metadata: dto.metadata as Prisma.InputJsonValue } : {}),
      ...(dto.price !== undefined ? { price: dto.price } : {}),
      ...(dto.rating !== undefined ? { rating: dto.rating } : {}),
      ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
      ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
      ...(dto.merchantId !== undefined ? { merchantId: dto.merchantId } : {}),
      ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
      ...(dto.brandId !== undefined ? { brandId: dto.brandId } : {}),
    };
  }

  private normalizeQuery(query?: string): string {
    return query?.trim().replace(/\s+/g, ' ').toLowerCase() ?? '';
  }
}
