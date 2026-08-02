import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { DomainEventBus } from '../events/domain-event-bus';

import { MerchantProductsService } from './merchant-products.service';
import { ProductSearchSyncService } from './product-search-sync.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('MerchantProductsService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: MerchantProductsService;
  let userId: string;
  let otherUserId: string;
  const context = {};

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
    const productSearchSync = new ProductSearchSyncService(new DomainEventBus());
    service = new MerchantProductsService(prisma, auditService, productSearchSync);

    const user = await prisma.user.create({
      data: {
        email: `merchant-products-test-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Owner',
        lastName: 'Merchant',
      },
    });
    userId = user.id;
    await prisma.merchantProfile.create({ data: { userId: user.id } });

    const other = await prisma.user.create({
      data: {
        email: `merchant-products-other-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Other',
        lastName: 'Merchant',
      },
    });
    otherUserId = other.id;
    await prisma.merchantProfile.create({ data: { userId: other.id } });
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: otherUserId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it('creates a product with a default zero-quantity inventory row', async () => {
    if (!databaseAvailable) return;

    const product = await service.createProduct(
      userId,
      { name: 'Basmati Rice 5kg', basePrice: 4500 },
      context,
    );

    expect(product.status).toBe('DRAFT');
    expect(product.slug).toBe('basmati-rice-5kg');
    expect(product.currency).toBe('NGN');
    expect(product.inventory).toMatchObject({ quantity: 0, reserved: 0, available: 0 });
  });

  it('disambiguates a duplicate slug for the same merchant with a suffix', async () => {
    if (!databaseAvailable) return;

    await service.createProduct(userId, { name: 'Bread Loaf', basePrice: 800 }, context);
    const second = await service.createProduct(
      userId,
      { name: 'Bread Loaf', basePrice: 900 },
      context,
    );

    expect(second.slug).not.toBe('bread-loaf');
    expect(second.slug.startsWith('bread-loaf-')).toBe(true);
  });

  it('updates only the provided fields', async () => {
    if (!databaseAvailable) return;

    const created = await service.createProduct(
      userId,
      { name: 'Cooking Oil', basePrice: 2000 },
      context,
    );
    const updated = await service.updateProduct(userId, created.id, { basePrice: 2200 }, context);

    expect(updated.name).toBe('Cooking Oil');
    expect(updated.basePrice).toBe(2200);
  });

  it('rejects updates to a product owned by a different merchant', async () => {
    if (!databaseAvailable) return;

    const created = await service.createProduct(
      userId,
      { name: 'Sugar 1kg', basePrice: 1200 },
      context,
    );

    await expect(
      service.updateProduct(otherUserId, created.id, { basePrice: 1 }, context),
    ).rejects.toThrow('Product not found');
  });

  it('publishes a draft product and rejects publishing twice', async () => {
    if (!databaseAvailable) return;

    const created = await service.createProduct(
      userId,
      { name: 'Beans 5kg', basePrice: 3000 },
      context,
    );
    const published = await service.publishProduct(userId, created.id, context);

    expect(published.status).toBe('PUBLISHED');
    expect(published.publishedAt).not.toBeNull();

    await expect(service.publishProduct(userId, created.id, context)).rejects.toThrow(
      'Product is already published',
    );
  });

  it('unpublishes a published product and rejects unpublishing a draft', async () => {
    if (!databaseAvailable) return;

    const created = await service.createProduct(
      userId,
      { name: 'Milk 1L', basePrice: 1500 },
      context,
    );

    await expect(service.unpublishProduct(userId, created.id, context)).rejects.toThrow(
      'Product is not published',
    );

    await service.publishProduct(userId, created.id, context);
    const archived = await service.unpublishProduct(userId, created.id, context);
    expect(archived.status).toBe('ARCHIVED');
  });

  it('soft-deletes a product and excludes it from ownership lookups', async () => {
    if (!databaseAvailable) return;

    const created = await service.createProduct(
      userId,
      { name: 'Tomato Paste', basePrice: 500 },
      context,
    );
    await service.deleteProduct(userId, created.id, context);

    await expect(service.getOwnProduct(userId, created.id)).rejects.toThrow('Product not found');
  });

  it('manages images including reordering with exact-set validation', async () => {
    if (!databaseAvailable) return;

    const created = await service.createProduct(
      userId,
      { name: 'Yam Tuber', basePrice: 1000 },
      context,
    );
    const withFirst = await service.addImage(
      userId,
      created.id,
      { url: 'https://example.com/yam-1.jpg' },
      context,
    );
    const withSecond = await service.addImage(
      userId,
      created.id,
      { url: 'https://example.com/yam-2.jpg' },
      context,
    );

    expect(withSecond.images).toHaveLength(2);
    expect(withFirst.images[0]?.position).toBe(0);

    const [first, second] = withSecond.images;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    const firstId = first?.id ?? '';
    const secondId = second?.id ?? '';

    await expect(
      service.reorderImages(userId, created.id, { imageIds: [firstId, randomUUID()] }, context),
    ).rejects.toThrow("imageIds must match the product's existing image set exactly");

    const reordered = await service.reorderImages(
      userId,
      created.id,
      { imageIds: [secondId, firstId] },
      context,
    );
    expect(reordered.images.map((image) => image.id)).toEqual([secondId, firstId]);

    const afterRemoval = await service.removeImage(userId, created.id, firstId, context);
    expect(afterRemoval.images).toHaveLength(1);
  });

  it('manages variants scoped to the owning merchant', async () => {
    if (!databaseAvailable) return;

    const created = await service.createProduct(
      userId,
      { name: 'T-Shirt', basePrice: 5000 },
      context,
    );
    const withVariant = await service.createVariant(
      userId,
      created.id,
      { name: 'Large', priceOverride: 5500 },
      context,
    );
    const variant = withVariant.variants[0];
    expect(variant).toBeDefined();
    const variantId = variant?.id ?? '';
    expect(variant?.priceOverride).toBe(5500);

    const updated = await service.updateVariant(
      userId,
      created.id,
      variantId,
      { isActive: false },
      context,
    );
    expect(updated.variants[0]?.isActive).toBe(false);

    await expect(
      service.updateVariant(otherUserId, created.id, variantId, { isActive: true }, context),
    ).rejects.toThrow('Product not found');

    const afterRemoval = await service.removeVariant(userId, created.id, variantId, context);
    expect(afterRemoval.variants).toHaveLength(0);
  });

  it('updates inventory quantity and stock tracking', async () => {
    if (!databaseAvailable) return;

    const created = await service.createProduct(
      userId,
      { name: 'Rice Bag 10kg', basePrice: 9000 },
      context,
    );
    const updated = await service.updateInventory(
      userId,
      created.id,
      { quantity: 50, lowStockAlert: 5 },
      context,
    );

    expect(updated.inventory).toMatchObject({ quantity: 50, available: 50, lowStockAlert: 5 });
  });

  it('marks a product out of stock and available again on restock', async () => {
    if (!databaseAvailable) return;

    const created = await service.createProduct(
      userId,
      { name: 'Manual Toggle Item', basePrice: 1200 },
      context,
    );
    await service.updateInventory(userId, created.id, { quantity: 20 }, context);

    const disabled = await service.setOutOfStock(userId, created.id, true, context);
    expect(disabled.inventory).toMatchObject({ manuallyDisabled: true });

    const reenabled = await service.setOutOfStock(userId, created.id, false, context);
    expect(reenabled.inventory).toMatchObject({ manuallyDisabled: false });
  });

  it("lists only the merchant's own, non-deleted products with pagination", async () => {
    if (!databaseAvailable) return;

    const created = await service.createProduct(
      userId,
      { name: 'Pagination Probe', basePrice: 100 },
      context,
    );
    const page = await service.listOwnProducts(userId, { page: 1, pageSize: 100 });

    expect(page.items.some((item) => item.id === created.id)).toBe(true);
    expect(page.items.every((item) => item.merchantId === page.items[0]?.merchantId)).toBe(true);

    const otherPage = await service.listOwnProducts(otherUserId, { page: 1, pageSize: 100 });
    expect(otherPage.items.some((item) => item.id === created.id)).toBe(false);
  });
});
