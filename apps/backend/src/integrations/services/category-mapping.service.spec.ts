import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { CONFLICT_TYPE } from '../catalogue-ingestion.constants';

import { CategoryMappingService } from './category-mapping.service';

import type { PrismaService } from '../../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * Against real Postgres, because the rules under test are database rules: the
 * `(integrationId, externalCategoryName)` unique index that makes `upsert`
 * idempotent, and the foreign key to `Category` that is the whole reason a POS
 * cannot invent a category.
 *
 * These cover the write half. Until it existed the service exposed only
 * `resolve()` and no controller referenced it, so a merchant had no way to
 * create the data ingestion reads — every POS category resolved
 * CATEGORY_UNMAPPED forever, which the unit tests could not see because they
 * only ever tested reading data a fixture had inserted.
 */
describe('CategoryMappingService write path', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: CategoryMappingService;
  let integrationId: string;
  let otherIntegrationId: string;
  let categoryId: string;
  let secondCategoryId: string;
  let inactiveCategoryId: string;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    }) as unknown as PrismaService;
    try {
      await prisma.$connect();
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
      return;
    }

    const makeIntegration = async (): Promise<string> => {
      const row = await prisma.merchantIntegration.create({
        data: {
          merchantId: randomUUID(),
          integrationName: 'spec',
          posProvider: 'CUSTOM',
          status: 'ACTIVE',
        },
      });
      return row.id;
    };
    integrationId = await makeIntegration();
    otherIntegrationId = await makeIntegration();

    const makeCategory = async (isActive: boolean): Promise<string> => {
      const slug = `spec-cat-${randomUUID()}`;
      const row = await prisma.category.create({
        data: { name: slug, slug, isActive },
      });
      return row.id;
    };
    categoryId = await makeCategory(true);
    secondCategoryId = await makeCategory(true);
    inactiveCategoryId = await makeCategory(false);

    service = new CategoryMappingService(prisma);
  });

  afterAll(async () => {
    if (!databaseAvailable) return;
    await prisma.categoryMapping.deleteMany({
      where: { integrationId: { in: [integrationId, otherIntegrationId] } },
    });
    await prisma.merchantIntegration.deleteMany({
      where: { id: { in: [integrationId, otherIntegrationId] } },
    });
    await prisma.category.deleteMany({
      where: { id: { in: [categoryId, secondCategoryId, inactiveCategoryId] } },
    });
    await prisma.$disconnect();
  });

  const guard = (): boolean => {
    if (!databaseAvailable) {
      throw new Error('DATABASE_URL is required for this spec');
    }
    return true;
  };

  it('creates a mapping that resolve() then finds', async () => {
    guard();
    const before = await service.resolve(integrationId, 'Grill Items');
    expect(before.categoryId).toBeNull();
    expect(before.conflictType).toBe(CONFLICT_TYPE.CATEGORY_UNMAPPED);

    await service.upsert(integrationId, 'Grill Items', categoryId);

    const after = await service.resolve(integrationId, 'Grill Items');
    expect(after.categoryId).toBe(categoryId);
    expect(after.conflictType).toBeNull();
  });

  it('is idempotent, and re-points an existing mapping rather than duplicating it', async () => {
    guard();
    await service.upsert(integrationId, 'Repeat Me', categoryId);
    await service.upsert(integrationId, 'Repeat Me', categoryId);
    await service.upsert(integrationId, 'Repeat Me', secondCategoryId);

    const rows = await prisma.categoryMapping.findMany({
      where: { integrationId, externalCategoryName: 'Repeat Me' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.categoryId).toBe(secondCategoryId);
  });

  it('refuses to map to a category that does not exist', async () => {
    guard();
    await expect(service.upsert(integrationId, 'Invented', randomUUID())).rejects.toThrow(
      /Category not found/,
    );
  });

  it('trims the external name so a stray space is not a second mapping', async () => {
    guard();
    await service.upsert(integrationId, '  Padded  ', categoryId);
    const resolved = await service.resolve(integrationId, 'Padded');
    expect(resolved.categoryId).toBe(categoryId);
  });

  it('accepts an inactive category, and resolve() reports it rather than hiding it', async () => {
    guard();
    await service.upsert(integrationId, 'Seasonal', inactiveCategoryId);
    const resolved = await service.resolve(integrationId, 'Seasonal');
    expect(resolved.categoryId).toBe(inactiveCategoryId);
    expect(resolved.conflictType).toBe(CONFLICT_TYPE.CATEGORY_INACTIVE);
  });

  it('scopes mappings to their integration', async () => {
    guard();
    await service.upsert(integrationId, 'Scoped', categoryId);

    const otherResolution = await service.resolve(otherIntegrationId, 'Scoped');
    expect(otherResolution.categoryId).toBeNull();
    expect(otherResolution.conflictType).toBe(CONFLICT_TYPE.CATEGORY_UNMAPPED);

    const listed = await service.list(otherIntegrationId);
    expect(listed).toHaveLength(0);
  });

  it('lists mappings with the resolved category', async () => {
    guard();
    await service.upsert(integrationId, 'Listed', categoryId);
    const rows = await service.list(integrationId);
    const listed = rows.find((row) => row.externalCategoryName === 'Listed');
    expect(listed?.categoryId).toBe(categoryId);
    expect(listed?.categoryIsActive).toBe(true);
  });

  it('removes a mapping, and reports a missing one rather than succeeding silently', async () => {
    guard();
    await service.upsert(integrationId, 'Temporary', categoryId);
    await service.remove(integrationId, 'Temporary');

    const resolved = await service.resolve(integrationId, 'Temporary');
    expect(resolved.conflictType).toBe(CONFLICT_TYPE.CATEGORY_UNMAPPED);

    await expect(service.remove(integrationId, 'Temporary')).rejects.toThrow(
      /Category mapping not found/,
    );
  });
});
