import { randomUUID } from 'node:crypto';

import { PrismaClient, ProductStatus } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import { DomainEventBus } from '../../events/domain-event-bus';
import { MerchantProductsService } from '../../products/merchant-products.service';
import { ProductSearchSyncService } from '../../products/product-search-sync.service';
import {
  CATALOG_SYNC_JOB_STATUS,
  CONFLICT_TYPE,
  INVENTORY_DELIVERY_STATUS,
} from '../catalogue-ingestion.constants';

import { CatalogueIngestionService } from './catalogue-ingestion.service';
import { CategoryMappingService } from './category-mapping.service';
import { InventoryIngestionService } from './inventory-ingestion.service';
import { MerchantProfileResolver } from './merchant-profile-resolver.service';

import type { AuditLogRepository } from '../../audit/repositories/audit-log.repository';
import type { PrismaService } from '../../prisma/prisma.service';
import type { IngestCatalogueDto } from '../dtos/ingest-catalogue.dto';
import type { MerchantIntegration } from '@prisma/client';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * Narrow a nullable value in a test without a `!` assertion. A missing value
 * here means the ingestion did not do what the test is about to assert, so
 * failing loudly at the point of absence beats a confusing downstream error.
 */
function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`expected ${what} to be present`);
  }
  return value;
}

/**
 * Verified against real Postgres rather than a mock, because every rule under
 * test here is a database rule: a unique index, a foreign key that points at a
 * different table than the column name suggests, and a column (`reserved`) that
 * must survive a write to the row beside it.
 */
describe('CatalogueIngestionService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: CatalogueIngestionService;
  let userId: string;
  let merchantProfileId: string;
  let integration: MerchantIntegration;

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
    const merchantProducts = new MerchantProductsService(
      prisma,
      auditService,
      new ProductSearchSyncService(new DomainEventBus()),
    );
    const merchantProfiles = new MerchantProfileResolver(prisma);
    service = new CatalogueIngestionService(
      prisma,
      merchantProducts,
      new CategoryMappingService(prisma),
      auditService,
      merchantProfiles,
      new InventoryIngestionService(prisma, merchantProfiles, auditService),
    );

    const user = await prisma.user.create({
      data: {
        email: `catalogue-ingestion-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Owner',
        lastName: 'Merchant',
      },
    });
    userId = user.id;
    const profile = await prisma.merchantProfile.create({ data: { userId: user.id } });
    merchantProfileId = profile.id;

    integration = await prisma.merchantIntegration.create({
      data: {
        // Deliberately the USER id, because that is what MerchantScoped stores
        // in this column today. The service must bridge to the profile itself.
        merchantId: user.id,
        integrationName: 'Test POS',
        posProvider: 'CUSTOM_POS',
        vendorName: 'Test POS',
      },
    });
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.$executeRawUnsafe(
        'DELETE FROM stock_movements WHERE reference_type = $1',
        'INTEGRATION',
      );
      await prisma.inventoryUpdate.deleteMany({ where: { integrationId: integration.id } });
      await prisma.integrationConflict.deleteMany({ where: { integrationId: integration.id } });
      await prisma.integrationLog.deleteMany({ where: { integrationId: integration.id } });
      await prisma.productSync.deleteMany({ where: { integrationId: integration.id } });
      await prisma.catalogSyncJob.deleteMany({ where: { integrationId: integration.id } });
      await prisma.categoryMapping.deleteMany({ where: { integrationId: integration.id } });
      await prisma.product.deleteMany({ where: { merchantId: merchantProfileId } });
      await prisma.merchantIntegration
        .delete({ where: { id: integration.id } })
        .catch(() => undefined);
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  const maybe = (name: string, fn: () => Promise<void>): void => {
    it(name, async () => {
      if (!databaseAvailable) {
        return;
      }
      await fn();
    });
  };

  describe('merchant resolution', () => {
    maybe(
      'creates products under the MerchantProfile id, not the User id in merchantId',
      async () => {
        const dto = batch([item()]);
        const result = await service.ingest(integration, dto, {});

        expect(result.jobStatus).toBe(CATALOG_SYNC_JOB_STATUS.COMPLETED);
        expect(result.productCount).toBe(1);

        const sync = await prisma.productSync.findUnique({
          where: {
            integrationId_externalSku: {
              integrationId: integration.id,
              externalSku: required(dto.items[0], 'first item').externalSku,
            },
          },
        });
        const product = await prisma.product.findUniqueOrThrow({
          where: { id: required(required(sync, 'product sync').productId, 'mapped productId') },
        });

        // The distinction the whole of Finding 1 turns on.
        expect(product.merchantId).toBe(merchantProfileId);
        expect(product.merchantId).not.toBe(integration.merchantId);
      },
    );
  });

  describe('idempotency', () => {
    maybe('returns the original job and applies nothing on replay', async () => {
      const dto = batch([item({ quantity: 7 })]);

      const first = await service.ingest(integration, dto, {});
      const second = await service.ingest(integration, dto, {});

      expect(second.replayed).toBe(true);
      expect(second.jobId).toBe(first.jobId);

      const jobs = await prisma.catalogSyncJob.findMany({
        where: { integrationId: integration.id, idempotencyKey: dto.idempotencyKey },
      });
      expect(jobs).toHaveLength(1);

      // The stock movement is the thing a double-apply would duplicate.
      const sync = await prisma.productSync.findUniqueOrThrow({
        where: {
          integrationId_externalSku: {
            integrationId: integration.id,
            externalSku: required(dto.items[0], 'first item').externalSku,
          },
        },
      });
      const updates = await prisma.inventoryUpdate.findMany({
        where: { productSyncId: sync.id },
      });
      expect(updates).toHaveLength(1);
    });
  });

  describe('inventory', () => {
    maybe('sets quantity and never touches reserved', async () => {
      const dto = batch([item({ quantity: 10 })]);
      await service.ingest(integration, dto, {});

      const sync = await prisma.productSync.findUniqueOrThrow({
        where: {
          integrationId_externalSku: {
            integrationId: integration.id,
            externalSku: required(dto.items[0], 'first item').externalSku,
          },
        },
      });

      // Simulate a customer holding stock in a cart.
      await prisma.productInventory.update({
        where: { productId: required(sync.productId, 'mapped productId') },
        data: { reserved: 4 },
      });

      await service.ingest(
        integration,
        {
          idempotencyKey: randomUUID(),
          items: [
            item({ externalSku: required(dto.items[0], 'first item').externalSku, quantity: 25 }),
          ],
        },
        {},
      );

      const inventory = await prisma.productInventory.findUniqueOrThrow({
        where: { productId: required(sync.productId, 'mapped productId') },
      });
      expect(inventory.quantity).toBe(25);
      // If this ever reads 0, stock promised to a customer mid-checkout was released.
      expect(inventory.reserved).toBe(4);
      expect(inventory.trackInventory).toBe(true);
    });

    maybe('clamps a negative quantity to zero and records a conflict', async () => {
      const dto = batch([item({ quantity: -5 })]);
      await service.ingest(integration, dto, {});

      const sync = await prisma.productSync.findUniqueOrThrow({
        where: {
          integrationId_externalSku: {
            integrationId: integration.id,
            externalSku: required(dto.items[0], 'first item').externalSku,
          },
        },
      });
      const inventory = await prisma.productInventory.findUniqueOrThrow({
        where: { productId: required(sync.productId, 'mapped productId') },
      });
      expect(inventory.quantity).toBe(0);

      const conflicts = await prisma.integrationConflict.findMany({
        where: {
          integrationId: integration.id,
          externalId: required(dto.items[0], 'first item').externalSku,
        },
      });
      expect(conflicts.map((c) => c.conflictType)).toContain(CONFLICT_TYPE.NEGATIVE_QUANTITY);
    });

    maybe('records an inbound update as DELIVERED with zero attempts', async () => {
      const dto = batch([item({ quantity: 3 })]);
      await service.ingest(integration, dto, {});

      const sync = await prisma.productSync.findUniqueOrThrow({
        where: {
          integrationId_externalSku: {
            integrationId: integration.id,
            externalSku: required(dto.items[0], 'first item').externalSku,
          },
        },
      });
      const update = await prisma.inventoryUpdate.findFirstOrThrow({
        where: { productSyncId: sync.id },
      });

      // Decision #9: existing fields, inbound semantics — not a new APPLIED value.
      expect(update.deliveryStatus).toBe(INVENTORY_DELIVERY_STATUS.DELIVERED);
      expect(update.attemptCount).toBe(0);
    });
  });

  describe('conflicts', () => {
    maybe('holds a merchant-edited price instead of overwriting it', async () => {
      const sku = `SKU-${randomUUID().slice(0, 8)}`;
      await service.ingest(integration, batch([item({ externalSku: sku, price: 500 })]), {});

      const sync = await prisma.productSync.findUniqueOrThrow({
        where: { integrationId_externalSku: { integrationId: integration.id, externalSku: sku } },
      });

      // The merchant edits the price in DrippleX after the sync.
      await prisma.product.update({
        where: { id: required(sync.productId, 'mapped productId') },
        data: { basePrice: 750 },
      });

      await service.ingest(integration, batch([item({ externalSku: sku, price: 500 })]), {});

      const product = await prisma.product.findUniqueOrThrow({
        where: { id: required(sync.productId, 'mapped productId') },
      });
      // Raise-and-hold: the merchant's edit survives.
      expect(product.basePrice.toString()).toBe('750');

      const conflicts = await prisma.integrationConflict.findMany({
        where: { integrationId: integration.id, externalId: sku },
      });
      expect(conflicts.map((c) => c.conflictType)).toContain(CONFLICT_TYPE.CATALOG_PRICE_DIFF);
      expect(conflicts.every((c) => c.status === 'OPEN')).toBe(true);
    });
  });

  describe('categories', () => {
    maybe('ingests an unmapped category as a conflict, not a failure', async () => {
      const dto = batch([item({ categoryName: 'Fizzy Drinks' })]);
      const result = await service.ingest(integration, dto, {});

      // The batch still succeeds — a taxonomy gap is not a catalogue outage.
      expect(result.jobStatus).toBe(CATALOG_SYNC_JOB_STATUS.COMPLETED);

      const sync = await prisma.productSync.findUniqueOrThrow({
        where: {
          integrationId_externalSku: {
            integrationId: integration.id,
            externalSku: required(dto.items[0], 'first item').externalSku,
          },
        },
      });
      const product = await prisma.product.findUniqueOrThrow({
        where: { id: required(sync.productId, 'mapped productId') },
      });
      expect(product.categoryId).toBeNull();

      const conflicts = await prisma.integrationConflict.findMany({
        where: {
          integrationId: integration.id,
          externalId: required(dto.items[0], 'first item').externalSku,
        },
      });
      expect(conflicts.map((c) => c.conflictType)).toContain(CONFLICT_TYPE.CATEGORY_UNMAPPED);
    });

    maybe('never creates a Category for an unmapped POS name', async () => {
      const before = await prisma.category.count();
      await service.ingest(integration, batch([item({ categoryName: 'Invented Aisle' })]), {});
      const after = await prisma.category.count();

      // Category.slug is globally unique — a POS creating one would claim that
      // slug for every merchant on the platform.
      expect(after).toBe(before);
    });
  });

  describe('validation', () => {
    maybe('rejects a non-NGN item without failing the rest of the batch', async () => {
      const good = item();
      const bad = item({ currency: 'USD' });
      const result = await service.ingest(integration, batch([good, bad]), {});

      expect(result.jobStatus).toBe(CATALOG_SYNC_JOB_STATUS.PARTIAL);
      expect(result.productCount).toBe(1);
      expect(result.failedCount).toBe(1);

      const conflicts = await prisma.integrationConflict.findMany({
        where: { integrationId: integration.id, externalId: bad.externalSku },
      });
      expect(conflicts.map((c) => c.conflictType)).toContain(CONFLICT_TYPE.CURRENCY_UNSUPPORTED);
    });

    maybe('records per-item failures against the job through correlationId', async () => {
      const bad = item({ currency: 'EUR' });
      const result = await service.ingest(integration, batch([bad]), {});

      // Decision #8: IntegrationLog carries what failureReason cannot.
      const logs = await prisma.integrationLog.findMany({
        where: { integrationId: integration.id, correlationId: result.jobId },
      });
      expect(logs).toHaveLength(1);
      expect(required(logs[0], 'integration log').errorMessage).toContain(bad.externalSku);
    });
  });

  describe('publication', () => {
    maybe('creates ingested products as DRAFT while autoPublish is off', async () => {
      const dto = batch([item()]);
      await service.ingest(integration, dto, {});

      const sync = await prisma.productSync.findUniqueOrThrow({
        where: {
          integrationId_externalSku: {
            integrationId: integration.id,
            externalSku: required(dto.items[0], 'first item').externalSku,
          },
        },
      });
      const product = await prisma.product.findUniqueOrThrow({
        where: { id: required(sync.productId, 'mapped productId') },
      });

      // A first sync must not publish an unreviewed catalogue to customers.
      expect(product.status).toBe(ProductStatus.DRAFT);
    });
  });

  describe('deletes', () => {
    maybe('archives an item inactive at source rather than deleting it', async () => {
      const sku = `SKU-${randomUUID().slice(0, 8)}`;
      await service.ingest(integration, batch([item({ externalSku: sku })]), {});
      await service.ingest(integration, batch([item({ externalSku: sku, active: false })]), {});

      const sync = await prisma.productSync.findUniqueOrThrow({
        where: { integrationId_externalSku: { integrationId: integration.id, externalSku: sku } },
      });
      const product = await prisma.product.findUniqueOrThrow({
        where: { id: required(sync.productId, 'mapped productId') },
      });

      // OrderItem references Product; a hard delete would destroy order history.
      expect(product.status).toBe(ProductStatus.ARCHIVED);
      expect(product.isDeleted).toBe(false);
    });
  });
});
