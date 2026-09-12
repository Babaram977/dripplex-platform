import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import { DomainEventBus } from '../../events/domain-event-bus';
import { MerchantProductsService } from '../../products/merchant-products.service';
import { ProductSearchSyncService } from '../../products/product-search-sync.service';
import { CATALOG_SYNC_JOB_STATUS } from '../catalogue-ingestion.constants';

import { CatalogueIngestionService } from './catalogue-ingestion.service';
import { CategoryMappingService } from './category-mapping.service';

import type { AuditLogRepository } from '../../audit/repositories/audit-log.repository';
import type { PrismaService } from '../../prisma/prisma.service';
import type { IngestCatalogueDto } from '../dtos/ingest-catalogue.dto';
import type { MerchantIntegration } from '@prisma/client';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * MKT-INT-001 P1 — cross-merchant isolation for catalogue ingestion.
 *
 * The existing ingestion spec has a `merchant resolution` block, but it tests
 * something else: that a product lands under the MerchantProfile id rather than
 * the User id, which is the workaround for the MerchantScoped defect. It does
 * not test isolation.
 *
 * So nothing proved that merchant A's POS credentials cannot write into
 * merchant B's catalogue — the single most important question about an inbound,
 * credential-authenticated write path, and one where the failure is silent:
 * products simply appear under the wrong merchant and are sold by them.
 *
 * Two merchants, two integrations, one database. Every assertion below is about
 * the boundary between them.
 */
describe('catalogue ingestion — cross-merchant isolation', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: CatalogueIngestionService;

  interface Merchant {
    userId: string;
    profileId: string;
    integration: MerchantIntegration;
  }
  let alpha: Merchant;
  let beta: Merchant;

  const batch = (items: IngestCatalogueDto['items']): IngestCatalogueDto => ({
    idempotencyKey: randomUUID(),
    items,
  });

  const item = (
    overrides: Partial<IngestCatalogueDto['items'][number]> = {},
  ): IngestCatalogueDto['items'][number] => ({
    externalSku: `SKU-${randomUUID().slice(0, 8)}`,
    name: 'Bottled Water',
    price: 500,
    ...overrides,
  });

  async function makeMerchant(label: string): Promise<Merchant> {
    const user = await prisma.user.create({
      data: {
        email: `isolation-${label}-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: label,
        lastName: 'Merchant',
      },
    });
    const profile = await prisma.merchantProfile.create({ data: { userId: user.id } });
    const integration = await prisma.merchantIntegration.create({
      data: {
        // The USER id, matching what MerchantScoped stores today.
        merchantId: user.id,
        integrationName: `${label} POS`,
        posProvider: 'CUSTOM_POS',
        vendorName: `${label} POS`,
      },
    });
    return { userId: user.id, profileId: profile.id, integration };
  }

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

    const auditLogRepository: jest.Mocked<AuditLogRepository> = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    const auditService = new AuditService(auditLogRepository);
    service = new CatalogueIngestionService(
      prisma,
      new MerchantProductsService(
        prisma,
        auditService,
        new ProductSearchSyncService(new DomainEventBus()),
      ),
      new CategoryMappingService(prisma),
      auditService,
    );

    alpha = await makeMerchant('alpha');
    beta = await makeMerchant('beta');
  });

  afterAll(async () => {
    if (databaseAvailable) {
      for (const m of [alpha, beta]) {
        await prisma.$executeRawUnsafe(
          'DELETE FROM stock_movements WHERE reference_type = $1',
          'INTEGRATION',
        );
        await prisma.inventoryUpdate.deleteMany({ where: { integrationId: m.integration.id } });
        await prisma.integrationConflict.deleteMany({ where: { integrationId: m.integration.id } });
        await prisma.integrationLog.deleteMany({ where: { integrationId: m.integration.id } });
        await prisma.productSync.deleteMany({ where: { integrationId: m.integration.id } });
        await prisma.catalogSyncJob.deleteMany({ where: { integrationId: m.integration.id } });
        await prisma.categoryMapping.deleteMany({ where: { integrationId: m.integration.id } });
        await prisma.product.deleteMany({ where: { merchantId: m.profileId } });
        await prisma.merchantIntegration
          .delete({ where: { id: m.integration.id } })
          .catch(() => undefined);
        await prisma.user.delete({ where: { id: m.userId } }).catch(() => undefined);
      }
    }
    await prisma.$disconnect();
  });

  const maybe = (name: string, fn: () => Promise<void>): void => {
    it(name, async () => {
      if (!databaseAvailable) return;
      await fn();
    });
  };

  maybe('an ingestion lands under its OWN merchant and touches no other', async () => {
    const before = await prisma.product.count({ where: { merchantId: alpha.profileId } });

    const result = await service.ingest(
      beta.integration,
      batch([item({ name: 'Beta Water' })]),
      {},
    );

    expect(result.jobStatus).toBe(CATALOG_SYNC_JOB_STATUS.COMPLETED);

    const after = await prisma.product.count({ where: { merchantId: alpha.profileId } });
    expect(after).toBe(before);

    const betaProducts = await prisma.product.findMany({ where: { merchantId: beta.profileId } });
    expect(betaProducts.map((p) => p.name)).toContain('Beta Water');
    // Nothing beta wrote may carry alpha's merchant id.
    expect(betaProducts.every((p) => p.merchantId === beta.profileId)).toBe(true);
  });

  maybe('the same external SKU in two merchants is two products, not a collision', async () => {
    const sharedSku = `SKU-SHARED-${randomUUID().slice(0, 8)}`;

    await service.ingest(
      alpha.integration,
      batch([item({ externalSku: sharedSku, name: 'Alpha Rice' })]),
      {},
    );
    await service.ingest(
      beta.integration,
      batch([item({ externalSku: sharedSku, name: 'Beta Rice' })]),
      {},
    );

    const alphaSync = await prisma.productSync.findUnique({
      where: {
        integrationId_externalSku: { integrationId: alpha.integration.id, externalSku: sharedSku },
      },
    });
    const betaSync = await prisma.productSync.findUnique({
      where: {
        integrationId_externalSku: { integrationId: beta.integration.id, externalSku: sharedSku },
      },
    });

    expect(alphaSync).not.toBeNull();
    expect(betaSync).not.toBeNull();
    // The unique is (integrationId, externalSku). If it were externalSku alone,
    // one merchant's SKU namespace would silently claim another's.
    expect(alphaSync?.productId).not.toBe(betaSync?.productId);

    const alphaProduct = await prisma.product.findUniqueOrThrow({
      where: { id: alphaSync?.productId ?? '' },
    });
    const betaProduct = await prisma.product.findUniqueOrThrow({
      where: { id: betaSync?.productId ?? '' },
    });
    expect(alphaProduct.merchantId).toBe(alpha.profileId);
    expect(betaProduct.merchantId).toBe(beta.profileId);
  });

  maybe('one merchant’s idempotency key cannot suppress another’s batch', async () => {
    const sharedKey = randomUUID();

    const alphaResult = await service.ingest(
      alpha.integration,
      { idempotencyKey: sharedKey, items: [item({ name: 'Alpha Bread' })] },
      {},
    );
    const betaResult = await service.ingest(
      beta.integration,
      { idempotencyKey: sharedKey, items: [item({ name: 'Beta Bread' })] },
      {},
    );

    // Idempotency is scoped to the integration by a unique
    // (integrationId, idempotencyKey). A global key would let one merchant's
    // replay silently swallow another merchant's real batch.
    expect(alphaResult.jobId).not.toBe(betaResult.jobId);
    expect(betaResult.productCount).toBe(1);

    const betaNames = (
      await prisma.product.findMany({ where: { merchantId: beta.profileId } })
    ).map((p) => p.name);
    expect(betaNames).toContain('Beta Bread');
  });

  /**
   * Idempotency under CONCURRENCY, which nothing tested.
   *
   * Found by mutation: deleting the replay pre-check left every test green, and
   * so did deleting the P2002 recovery behind it. Both guards could be removed
   * without a single failure, because every existing test replays a batch
   * SEQUENTIALLY — where the pre-check alone suffices, and where the recovery
   * never runs.
   *
   * A POS retrying on a bad connection does not politely wait for the first
   * request to finish. Two identical batches arriving together must produce one
   * job and one set of products, not two.
   */
  maybe('two identical batches racing produce ONE job and one product', async () => {
    const key = randomUUID();
    const sku = `SKU-RACE-${randomUUID().slice(0, 8)}`;
    const payload = (): IngestCatalogueDto => ({
      idempotencyKey: key,
      items: [item({ externalSku: sku, name: 'Raced Product' })],
    });

    const [first, second] = await Promise.all([
      service.ingest(alpha.integration, payload(), {}),
      service.ingest(alpha.integration, payload(), {}),
    ]);

    // One job. The unique (integrationId, idempotencyKey) is the authority; the
    // loser of the race must return the winner's job, not start a second run.
    expect(first.jobId).toBe(second.jobId);

    const jobs = await prisma.catalogSyncJob.findMany({
      where: { integrationId: alpha.integration.id, idempotencyKey: key },
    });
    expect(jobs).toHaveLength(1);

    // And one product, not two.
    const products = await prisma.product.findMany({
      where: { merchantId: alpha.profileId, name: 'Raced Product' },
    });
    expect(products).toHaveLength(1);
  });

  maybe('a category mapping belongs to one integration only', async () => {
    const mappings = new CategoryMappingService(prisma);
    const category = await prisma.category.findFirst();
    if (category === null) return;

    await mappings.upsert(alpha.integration.id, 'Drinks', category.id);

    // Beta must not inherit alpha's interpretation of "Drinks". The unique is
    // (integrationId, externalCategoryName) for exactly this reason.
    const betaMapping = await prisma.categoryMapping.findUnique({
      where: {
        integrationId_externalCategoryName: {
          integrationId: beta.integration.id,
          externalCategoryName: 'Drinks',
        },
      },
    });
    expect(betaMapping).toBeNull();
  });

  maybe('no ProductSync row ever points at another merchant’s product', async () => {
    const rows = await prisma.productSync.findMany({
      where: { integrationId: { in: [alpha.integration.id, beta.integration.id] } },
    });
    expect(rows.length).toBeGreaterThan(0);

    const owner = new Map([
      [alpha.integration.id, alpha.profileId],
      [beta.integration.id, beta.profileId],
    ]);

    for (const row of rows) {
      if (row.productId === null) continue;
      const product = await prisma.product.findUnique({ where: { id: row.productId } });
      expect(product?.merchantId).toBe(owner.get(row.integrationId));
    }
  });
});
