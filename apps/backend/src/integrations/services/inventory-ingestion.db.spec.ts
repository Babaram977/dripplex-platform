import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import {
  CONFLICT_TYPE,
  INVENTORY_REJECTION,
  MAPPING_STATUS,
} from '../catalogue-ingestion.constants';

import { deriveItemKey, InventoryIngestionService } from './inventory-ingestion.service';
import { MerchantProfileResolver } from './merchant-profile-resolver.service';

import type { AuditLogRepository } from '../../audit/repositories/audit-log.repository';
import type { PrismaService } from '../../prisma/prisma.service';
import type { MerchantIntegration } from '@prisma/client';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * MKT-INT-001-J — the inventory writer, against a real database.
 *
 * Everything here needs Postgres to mean anything. The row lock, the unique
 * index that carries idempotency, the transaction that rolls a duplicate back
 * before any stock moves — none of them exist in a mocked Prisma client, and a
 * green suite built on one would prove only that the mocks agree with
 * themselves.
 *
 * Two merchants share the database throughout, because the failure this path
 * must not have is silent: stock landing under the wrong merchant does not
 * raise anything, it just oversells one shop and starves another.
 */
describe('inventory ingestion — real database', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: InventoryIngestionService;

  interface Merchant {
    userId: string;
    profileId: string;
    integration: MerchantIntegration;
  }
  let alpha: Merchant;
  let beta: Merchant;

  async function makeMerchant(label: string): Promise<Merchant> {
    const user = await prisma.user.create({
      data: {
        email: `inventory-${label}-${randomUUID()}@dripplex.test`,
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

  /** A catalogued product with a live SKU mapping and a starting stock level. */
  async function makeMapped(
    merchant: Merchant,
    startingQuantity: number,
    options: { reserved?: number; externalSku?: string } = {},
  ): Promise<{ productId: string; productSyncId: string; externalSku: string }> {
    const suffix = randomUUID().slice(0, 8);
    const product = await prisma.product.create({
      data: {
        merchantId: merchant.profileId,
        name: `Water ${suffix}`,
        slug: `water-${suffix}`,
        basePrice: 500,
      },
    });
    await prisma.productInventory.create({
      data: {
        productId: product.id,
        quantity: startingQuantity,
        reserved: options.reserved ?? 0,
        trackInventory: true,
      },
    });
    const externalSku = options.externalSku ?? `SKU-${suffix}`;
    const mapping = await prisma.productSync.create({
      data: {
        integrationId: merchant.integration.id,
        externalSku,
        productId: product.id,
        mappingStatus: MAPPING_STATUS.ACTIVE,
      },
    });
    return { productId: product.id, productSyncId: mapping.id, externalSku };
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
    service = new InventoryIngestionService(
      prisma,
      new MerchantProfileResolver(prisma),
      new AuditService(auditLogRepository),
    );

    alpha = await makeMerchant('alpha');
    beta = await makeMerchant('beta');
  });

  afterAll(async () => {
    if (databaseAvailable) {
      for (const merchant of [alpha, beta]) {
        await prisma.$executeRawUnsafe(
          'DELETE FROM stock_movements WHERE reference_type = $1',
          'INTEGRATION',
        );
        await prisma.inventoryUpdate.deleteMany({
          where: { integrationId: merchant.integration.id },
        });
        await prisma.integrationConflict.deleteMany({
          where: { integrationId: merchant.integration.id },
        });
        await prisma.integrationLog.deleteMany({
          where: { integrationId: merchant.integration.id },
        });
        await prisma.productSync.deleteMany({ where: { integrationId: merchant.integration.id } });
        await prisma.product.deleteMany({ where: { merchantId: merchant.profileId } });
        await prisma.merchantIntegration
          .delete({ where: { id: merchant.integration.id } })
          .catch(() => undefined);
        await prisma.user.delete({ where: { id: merchant.userId } }).catch(() => undefined);
      }
    }
    await prisma.$disconnect();
  });

  /** The inventory row, or a failed test — never an optional the assertions have to guess at. */
  async function inventoryOf(
    productId: string,
  ): Promise<{ id: string; quantity: number; reserved: number }> {
    const inventory = await prisma.productInventory.findUnique({ where: { productId } });
    if (!inventory) {
      throw new Error(`No inventory row for product ${productId}`);
    }
    return inventory;
  }

  const maybe = (name: string, fn: () => Promise<void>): void => {
    it(name, async () => {
      if (!databaseAvailable) return;
      await fn();
    });
  };

  // ---------------------------------------------------------------- stock

  maybe('a push sets the absolute quantity and logs one movement', async () => {
    const mapped = await makeMapped(alpha, 12);

    const summary = await service.applyBatch(
      alpha.integration,
      [{ externalSku: mapped.externalSku, quantity: 40 }],
      randomUUID(),
      {},
    );

    expect(summary).toMatchObject({ appliedCount: 1, replayedCount: 0, rejectedCount: 0 });

    const inventory = await inventoryOf(mapped.productId);
    expect(inventory.quantity).toBe(40);

    const movements = await prisma.stockMovement.findMany({
      where: { inventoryId: inventory.id },
    });
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      balanceAfter: 40,
      referenceType: 'INTEGRATION',
      actorUserId: null,
    });
  });

  /**
   * The regression this file exists for.
   *
   * The catalogue path recorded `previousQuantity` from the row the upsert had
   * already written, so every `InventoryUpdate` said the stock had not moved:
   * previous and new were always the same number. Nothing asserted it, so it
   * was green. Reconciling a merchant's shelf against that audit trail would
   * have shown a POS that never changed anything.
   */
  maybe('previousQuantity is the value before the write, not after it', async () => {
    const mapped = await makeMapped(alpha, 7);

    await service.applyBatch(
      alpha.integration,
      [{ externalSku: mapped.externalSku, quantity: 99 }],
      randomUUID(),
      {},
    );

    const update = await prisma.inventoryUpdate.findFirst({
      where: { productSyncId: mapped.productSyncId },
      orderBy: { createdAt: 'desc' },
    });
    expect(update?.previousQuantity).toBe(7);
    expect(update?.newQuantity).toBe(99);
    expect(update?.previousQuantity).not.toBe(update?.newQuantity);
  });

  maybe('a push never touches reserved', async () => {
    // 30 on the shelf, 9 of them already promised to customers mid-checkout.
    const mapped = await makeMapped(alpha, 30, { reserved: 9 });

    await service.applyBatch(
      alpha.integration,
      [{ externalSku: mapped.externalSku, quantity: 5 }],
      randomUUID(),
      {},
    );

    const inventory = await inventoryOf(mapped.productId);
    expect(inventory.quantity).toBe(5);
    // Releasing these would hand stock already promised to somebody else.
    expect(inventory.reserved).toBe(9);
  });

  maybe('a negative quantity clamps to zero and raises one conflict', async () => {
    const mapped = await makeMapped(alpha, 20);

    const summary = await service.applyBatch(
      alpha.integration,
      [{ externalSku: mapped.externalSku, quantity: -4 }],
      randomUUID(),
      {},
    );

    expect(summary.appliedCount).toBe(1);
    const inventory = await inventoryOf(mapped.productId);
    expect(inventory.quantity).toBe(0);

    const conflicts = await prisma.integrationConflict.findMany({
      where: {
        integrationId: alpha.integration.id,
        conflictType: CONFLICT_TYPE.NEGATIVE_QUANTITY,
        externalId: mapped.externalSku,
      },
    });
    expect(conflicts).toHaveLength(1);
  });

  // ---------------------------------------------------------- idempotency

  maybe('replaying a batch key applies nothing the second time', async () => {
    const mapped = await makeMapped(alpha, 3);
    const batchKey = randomUUID();

    const first = await service.applyBatch(
      alpha.integration,
      [{ externalSku: mapped.externalSku, quantity: 25 }],
      batchKey,
      {},
    );
    // A POS that timed out and retried sends a different number the second
    // time only by mistake — and it must still not be applied.
    const second = await service.applyBatch(
      alpha.integration,
      [{ externalSku: mapped.externalSku, quantity: 1 }],
      batchKey,
      {},
    );

    expect(first.appliedCount).toBe(1);
    expect(second).toMatchObject({ appliedCount: 0, replayedCount: 1 });

    const inventory = await inventoryOf(mapped.productId);
    expect(inventory.quantity).toBe(25);

    const updates = await prisma.inventoryUpdate.findMany({
      where: { productSyncId: mapped.productSyncId },
    });
    expect(updates).toHaveLength(1);

    const movements = await prisma.stockMovement.findMany({
      where: { inventoryId: inventory.id },
    });
    expect(movements).toHaveLength(1);
  });

  maybe('a negative quantity replayed does not multiply the conflict', async () => {
    const mapped = await makeMapped(alpha, 11);
    const batchKey = randomUUID();
    const items = [{ externalSku: mapped.externalSku, quantity: -2 }];

    await service.applyBatch(alpha.integration, items, batchKey, {});
    await service.applyBatch(alpha.integration, items, batchKey, {});

    const conflicts = await prisma.integrationConflict.findMany({
      where: {
        integrationId: alpha.integration.id,
        conflictType: CONFLICT_TYPE.NEGATIVE_QUANTITY,
        externalId: mapped.externalSku,
      },
    });
    expect(conflicts).toHaveLength(1);
  });

  maybe('two identical batches racing apply once and replay once', async () => {
    const mapped = await makeMapped(alpha, 0);
    const batchKey = randomUUID();
    const items = [{ externalSku: mapped.externalSku, quantity: 64 }];

    const [left, right] = await Promise.all([
      service.applyBatch(alpha.integration, items, batchKey, {}),
      service.applyBatch(alpha.integration, items, batchKey, {}),
    ]);

    // Exactly one of them did the work; neither failed.
    expect(left.appliedCount + right.appliedCount).toBe(1);
    expect(left.replayedCount + right.replayedCount).toBe(1);

    const updates = await prisma.inventoryUpdate.findMany({
      where: { productSyncId: mapped.productSyncId },
    });
    expect(updates).toHaveLength(1);

    const inventory = await inventoryOf(mapped.productId);
    const movements = await prisma.stockMovement.findMany({
      where: { inventoryId: inventory.id },
    });
    // A rolled-back duplicate leaves no half-write behind: one movement, not
    // two, and not one movement for a quantity that was never applied.
    expect(movements).toHaveLength(1);
    expect(inventory.quantity).toBe(64);
  });

  maybe('a duplicated SKU inside one batch is refused, not silently replayed', async () => {
    const mapped = await makeMapped(alpha, 0);

    const summary = await service.applyBatch(
      alpha.integration,
      [
        { externalSku: mapped.externalSku, quantity: 10 },
        { externalSku: mapped.externalSku, quantity: 90 },
      ],
      randomUUID(),
      {},
    );

    expect(summary.appliedCount).toBe(1);
    expect(summary.rejectedCount).toBe(1);
    expect(summary.items.find((i) => i.status === 'REJECTED')?.reason).toBe(
      INVENTORY_REJECTION.DUPLICATE_IN_BATCH,
    );
  });

  // ------------------------------------------------------- concurrency

  maybe('concurrent writes to one product serialise without losing an update', async () => {
    const mapped = await makeMapped(alpha, 100);

    const [a, b] = await Promise.all([
      service.applyAbsoluteQuantity({
        integrationId: alpha.integration.id,
        productSyncId: mapped.productSyncId,
        productId: mapped.productId,
        merchantProfileId: alpha.profileId,
        externalSku: mapped.externalSku,
        requestedQuantity: 10,
        idempotencyKey: deriveItemKey(randomUUID(), mapped.externalSku),
      }),
      service.applyAbsoluteQuantity({
        integrationId: alpha.integration.id,
        productSyncId: mapped.productSyncId,
        productId: mapped.productId,
        merchantProfileId: alpha.profileId,
        externalSku: mapped.externalSku,
        requestedQuantity: 20,
        idempotencyKey: deriveItemKey(randomUUID(), mapped.externalSku),
      }),
    ]);

    const inventory = await inventoryOf(mapped.productId);

    // Both landed, and the loser of the race read the winner's number as its
    // own `previousQuantity`. The two updates chain; they do not both claim to
    // have started from 100, which is exactly what an unlocked read-then-write
    // would have produced and what makes a stock audit trail unreconcilable.
    const started = [a, b].filter((result) => result.previousQuantity === 100);
    expect(started).toHaveLength(1);

    const first = started[0];
    const second = [a, b].find((result) => result !== first);
    expect(second?.previousQuantity).toBe(first?.newQuantity);
    expect(inventory.quantity).toBe(second?.newQuantity);
  });

  // --------------------------------------------------------- isolation

  maybe("one merchant's credential cannot reach another's SKU", async () => {
    const betaStock = await makeMapped(beta, 50);

    const summary = await service.applyBatch(
      alpha.integration,
      [{ externalSku: betaStock.externalSku, quantity: 0 }],
      randomUUID(),
      {},
    );

    // Alpha's integration has no mapping for that SKU, so there is nothing to
    // write — and beta's shelf is untouched.
    expect(summary.rejectedCount).toBe(1);
    expect(summary.items[0]?.reason).toBe(INVENTORY_REJECTION.SKU_NOT_MAPPED);

    const inventory = await inventoryOf(betaStock.productId);
    expect(inventory.quantity).toBe(50);
  });

  /**
   * `ProductSync.productId` has no foreign key to `Product`, so the database
   * will happily hold a mapping under alpha that points at beta's product.
   * That is a recorded, unfixed schema hazard — which makes it exactly the
   * case the writer has to refuse on its own.
   */
  maybe('a mapping pointing at another merchant’s product is refused', async () => {
    const betaStock = await makeMapped(beta, 77);
    const smuggledSku = `SKU-SMUGGLED-${randomUUID().slice(0, 8)}`;
    await prisma.productSync.create({
      data: {
        integrationId: alpha.integration.id,
        externalSku: smuggledSku,
        // Beta's product, under alpha's integration. Nothing in the schema
        // stops this row existing.
        productId: betaStock.productId,
        mappingStatus: MAPPING_STATUS.ACTIVE,
      },
    });

    const summary = await service.applyBatch(
      alpha.integration,
      [{ externalSku: smuggledSku, quantity: 0 }],
      randomUUID(),
      {},
    );

    expect(summary.rejectedCount).toBe(1);
    expect(summary.items[0]?.reason).toBe(INVENTORY_REJECTION.PRODUCT_UNAVAILABLE);

    const inventory = await inventoryOf(betaStock.productId);
    expect(inventory.quantity).toBe(77);

    const updates = await prisma.inventoryUpdate.findMany({
      where: { integrationId: alpha.integration.id, externalSku: smuggledSku },
    });
    expect(updates).toHaveLength(0);
  });

  maybe('no inventory update ever references another merchant’s product', async () => {
    const updates = await prisma.inventoryUpdate.findMany({
      where: { integrationId: alpha.integration.id },
      include: { productSync: true },
    });
    expect(updates.length).toBeGreaterThan(0);

    const productIds = updates
      .map((update) => update.productSync.productId)
      .filter((id): id is string => typeof id === 'string');
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });

    expect(products.every((product) => product.merchantId === alpha.profileId)).toBe(true);
    expect(
      updates.every((update) => update.productSync.integrationId === alpha.integration.id),
    ).toBe(true);
  });

  // ---------------------------------------------------- failure recovery

  maybe('a mapping with no product yet is reported, not papered over', async () => {
    const orphanSku = `SKU-ORPHAN-${randomUUID().slice(0, 8)}`;
    // Exactly what a catalogue batch that died between creating the mapping
    // and creating the product leaves behind.
    await prisma.productSync.create({
      data: {
        integrationId: alpha.integration.id,
        externalSku: orphanSku,
        mappingStatus: MAPPING_STATUS.ACTIVE,
      },
    });

    const summary = await service.applyBatch(
      alpha.integration,
      [{ externalSku: orphanSku, quantity: 5 }],
      randomUUID(),
      {},
    );

    expect(summary.rejectedCount).toBe(1);
    expect(summary.items[0]?.reason).toBe(INVENTORY_REJECTION.SKU_NOT_LINKED);

    const logs = await prisma.integrationLog.findMany({
      where: { integrationId: alpha.integration.id, errorMessage: { contains: orphanSku } },
    });
    expect(logs).toHaveLength(1);
  });

  maybe('an archived mapping no longer accepts stock', async () => {
    const mapped = await makeMapped(alpha, 8);
    await prisma.productSync.update({
      where: { id: mapped.productSyncId },
      data: { mappingStatus: MAPPING_STATUS.ARCHIVED },
    });

    const summary = await service.applyBatch(
      alpha.integration,
      [{ externalSku: mapped.externalSku, quantity: 400 }],
      randomUUID(),
      {},
    );

    expect(summary.items[0]?.reason).toBe(INVENTORY_REJECTION.MAPPING_INACTIVE);
    const inventory = await inventoryOf(mapped.productId);
    expect(inventory.quantity).toBe(8);
  });

  maybe('one bad item does not reject the rest of the batch', async () => {
    const good = await makeMapped(alpha, 0);

    const summary = await service.applyBatch(
      alpha.integration,
      [
        { externalSku: `SKU-NOT-HERE-${randomUUID().slice(0, 8)}`, quantity: 3 },
        { externalSku: good.externalSku, quantity: 33 },
      ],
      randomUUID(),
      {},
    );

    expect(summary).toMatchObject({ appliedCount: 1, rejectedCount: 1 });
    const inventory = await inventoryOf(good.productId);
    expect(inventory.quantity).toBe(33);
  });

  maybe('a deleted product stops accepting stock', async () => {
    const mapped = await makeMapped(alpha, 15);
    await prisma.product.update({ where: { id: mapped.productId }, data: { isDeleted: true } });

    const summary = await service.applyBatch(
      alpha.integration,
      [{ externalSku: mapped.externalSku, quantity: 900 }],
      randomUUID(),
      {},
    );

    expect(summary.items[0]?.reason).toBe(INVENTORY_REJECTION.PRODUCT_UNAVAILABLE);
    const inventory = await inventoryOf(mapped.productId);
    expect(inventory.quantity).toBe(15);
  });

  // ------------------------------------------------------------ reading

  maybe('current levels report what a customer can actually buy', async () => {
    const mapped = await makeMapped(beta, 0, { reserved: 4 });
    await service.applyBatch(
      beta.integration,
      [{ externalSku: mapped.externalSku, quantity: 10 }],
      randomUUID(),
      {},
    );

    const levels = await service.listLevels(beta.integration.id);
    const level = levels.find((entry) => entry.externalSku === mapped.externalSku);

    expect(level).toMatchObject({ quantity: 10, reserved: 4, available: 6 });

    // And it reports only this integration's SKUs.
    const alphaSkus = await prisma.productSync.findMany({
      where: { integrationId: alpha.integration.id },
      select: { externalSku: true },
    });
    const alphaSet = new Set(alphaSkus.map((row) => row.externalSku));
    expect(levels.every((entry) => !alphaSet.has(entry.externalSku))).toBe(true);
  });
});
