import { SearchEntityType } from '@prisma/client';

import { SearchService } from './search.service';

import type { AuditService } from '../audit/audit.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { SearchDocument } from '@prisma/client';

const merchantId = '11111111-1111-4111-8111-111111111111';
const categoryId = '22222222-2222-4222-8222-222222222222';

const makeDocument = (overrides: Partial<SearchDocument> = {}): SearchDocument => ({
  id: '33333333-3333-4333-8333-333333333333',
  entityType: SearchEntityType.PRODUCT,
  entityId: '44444444-4444-4444-8444-444444444444',
  title: 'Blue Running Shoes',
  subtitle: 'Sneakers',
  description: 'Lightweight training shoes',
  keywords: ['shoes', 'running'],
  metadata: null,
  rankingScore: 10,
  available: true,
  price: null,
  rating: 4.5,
  latitude: null,
  longitude: null,
  merchantId,
  categoryId,
  brandId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

describe('SearchService', () => {
  let prisma: {
    searchDocument: {
      findMany: jest.Mock;
      count: jest.Mock;
      upsert: jest.Mock;
    };
    searchQueryLog: { create: jest.Mock };
    popularSearch: {
      findMany: jest.Mock;
      upsert: jest.Mock;
    };
    recentSearch: {
      create: jest.Mock;
      findMany: jest.Mock;
    };
  };
  let auditService: jest.Mocked<AuditService>;
  let service: SearchService;

  beforeEach(() => {
    prisma = {
      searchDocument: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        upsert: jest.fn(),
      },
      searchQueryLog: { create: jest.fn().mockResolvedValue({}) },
      popularSearch: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
      },
      recentSearch: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditService>;
    service = new SearchService(prisma as unknown as PrismaService, auditService);
  });

  it('builds fuzzy filters with price, availability, merchant, and category filters', async () => {
    await service.search(
      {
        q: 'shoe',
        type: SearchEntityType.PRODUCT,
        minPrice: 1000,
        maxPrice: 5000,
        available: true,
        merchantId,
        categoryId,
      },
      'user-1',
    );

    expect(prisma.searchDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: expect.arrayContaining([
            { deletedAt: null },
            { entityType: SearchEntityType.PRODUCT },
            { available: true },
            { merchantId },
            { categoryId },
            { price: { gte: 1000, lte: 5000 } },
            {
              OR: expect.arrayContaining([
                { title: { contains: 'shoe', mode: 'insensitive' } },
                { description: { contains: 'shoe', mode: 'insensitive' } },
              ]),
            },
          ]),
        },
      }),
    );
  });

  it('logs search queries, increments popularity, and records recent searches', async () => {
    prisma.searchDocument.findMany.mockResolvedValue([makeDocument()]);
    prisma.searchDocument.count.mockResolvedValue(1);

    await service.search({ q: '  Running   Shoes  ' }, 'user-1', { userId: 'user-1' });

    expect(prisma.searchQueryLog.create).toHaveBeenCalledWith({
      data: { query: 'running shoes', resultCount: 1, userId: 'user-1' },
    });
    expect(prisma.popularSearch.upsert).toHaveBeenCalledWith({
      where: { query: 'running shoes' },
      create: { query: 'running shoes', hitCount: 1 },
      update: { hitCount: { increment: 1 } },
    });
    expect(prisma.recentSearch.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', query: 'running shoes' },
    });
    expect(auditService.record).toHaveBeenCalled();
  });

  it('ranks exact title matches above partial matches', () => {
    const exact = service.rankDocument(makeDocument({ title: 'shoe' }), 'shoe');
    const partial = service.rankDocument(makeDocument({ title: 'Blue shoe' }), 'shoe');

    expect(exact).toBeGreaterThan(partial);
  });

  it('adds availability and rating to ranking', () => {
    const ranked = service.rankDocument(
      makeDocument({ rankingScore: 1, rating: 4, available: true }),
    );

    expect(ranked).toBe(7);
  });

  it('returns autocomplete suggestions from titles and keywords', async () => {
    prisma.searchDocument.findMany.mockResolvedValue([
      makeDocument({ title: 'Blue Running Shoes', keywords: ['running shoes', 'trainers'] }),
      makeDocument({ title: 'Blue Running Shoes', keywords: ['running shoes'] }),
    ]);

    await expect(service.autocomplete('run')).resolves.toEqual([
      'Blue Running Shoes',
      'running shoes',
    ]);
  });

  it('returns popular search suggestions', async () => {
    prisma.popularSearch.findMany.mockResolvedValue([{ query: 'running shoes' }]);

    await expect(service.suggestions('run')).resolves.toEqual(['running shoes']);
    expect(prisma.popularSearch.findMany).toHaveBeenCalledWith({
      where: { query: { contains: 'run', mode: 'insensitive' } },
      orderBy: [{ hitCount: 'desc' }, { updatedAt: 'desc' }],
      take: 10,
    });
  });

  it('deduplicates recent searches per user', async () => {
    prisma.recentSearch.findMany.mockResolvedValue([
      { query: 'shoes' },
      { query: 'bags' },
      { query: 'shoes' },
    ]);

    const rows = await service.recent('user-1', 10);

    expect(rows.map((row) => row.query)).toEqual(['shoes', 'bags']);
  });

  it('upserts search documents by entity composite key', async () => {
    prisma.searchDocument.upsert.mockResolvedValue(makeDocument());

    await service.upsertDocument({
      entityType: SearchEntityType.PRODUCT,
      entityId: '44444444-4444-4444-8444-444444444444',
      title: 'Blue Running Shoes',
      metadata: { source: 'event' },
    });

    expect(prisma.searchDocument.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          entityType_entityId: {
            entityType: SearchEntityType.PRODUCT,
            entityId: '44444444-4444-4444-8444-444444444444',
          },
        },
      }),
    );
  });
});
