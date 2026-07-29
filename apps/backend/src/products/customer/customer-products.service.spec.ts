import { randomUUID } from 'node:crypto';

import { FulfillmentType, Prisma, PrismaClient, ProductStatus, ReviewTargetType } from '@prisma/client';

import { NotFoundDomainException } from '../../common/exceptions/domain.exception';

import { CustomerProductsService } from './customer-products.service';

import type { PrismaService } from '../../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('CustomerProductsService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: CustomerProductsService;
  const userIds: string[] = [];

  let merchant1Id = '';
  let merchant2Id = '';
  let categoryGroceriesId = '';
  let categoryElectronicsId = '';
  let brandAcmeId = '';
  let brandZenithId = '';

  let riceId = '';
  let outOfStockId = '';
  let speakerId = '';
  let draftId = '';
  let featuredId = '';

  async function createMerchant(businessName: string): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `customer-catalog-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Merchant',
        lastName: businessName,
      },
    });
    userIds.push(user.id);
    const profile = await prisma.merchantProfile.create({ data: { userId: user.id } });
    await prisma.business.create({
      data: {
        merchantId: user.id,
        businessName,
        businessType: 'SOLE_PROPRIETORSHIP',
        registrationNumber: `REG-${randomUUID()}`,
        email: `${businessName.toLowerCase()}-${randomUUID()}@dripplex.test`,
        phone: '+2348000000000',
        country: 'Nigeria',
        state: 'Lagos',
        city: 'Ikeja',
        address: '1 Market Road',
        latitude: new Prisma.Decimal('6.6018'),
        longitude: new Prisma.Decimal('3.3515'),
        logoUrl: 'https://example.com/logo.png',
      },
    });
    return profile.id;
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

    service = new CustomerProductsService(prisma);

    merchant1Id = await createMerchant('AcmeMart');
    merchant2Id = await createMerchant('ZenithElectronics');

    const groceries = await prisma.category.create({
      data: { name: 'Groceries', slug: `groceries-${randomUUID()}` },
    });
    categoryGroceriesId = groceries.id;
    const electronics = await prisma.category.create({
      data: { name: 'Electronics', slug: `electronics-${randomUUID()}` },
    });
    categoryElectronicsId = electronics.id;

    const acme = await prisma.brand.create({ data: { name: 'Acme', slug: `acme-${randomUUID()}` } });
    brandAcmeId = acme.id;
    const zenith = await prisma.brand.create({ data: { name: 'Zenith', slug: `zenith-${randomUUID()}` } });
    brandZenithId = zenith.id;

    const rice = await prisma.product.create({
      data: {
        merchantId: merchant1Id,
        categoryId: categoryGroceriesId,
        brandId: brandAcmeId,
        name: 'Basmati Rice',
        slug: `basmati-rice-${randomUUID()}`,
        sku: 'RICE-1',
        basePrice: new Prisma.Decimal('1000'),
        status: ProductStatus.PUBLISHED,
        publishedAt: new Date(),
        images: { create: [{ url: 'https://example.com/rice.jpg' }] },
        inventory: { create: { quantity: 10, reserved: 0, trackInventory: true } },
      },
    });
    riceId = rice.id;

    const outOfStock = await prisma.product.create({
      data: {
        merchantId: merchant1Id,
        categoryId: categoryGroceriesId,
        brandId: brandAcmeId,
        name: 'Brown Rice',
        slug: `brown-rice-${randomUUID()}`,
        sku: 'RICE-2',
        basePrice: new Prisma.Decimal('2000'),
        status: ProductStatus.PUBLISHED,
        publishedAt: new Date(),
        inventory: { create: { quantity: 0, reserved: 0, trackInventory: true } },
      },
    });
    outOfStockId = outOfStock.id;

    const speaker = await prisma.product.create({
      data: {
        merchantId: merchant2Id,
        categoryId: categoryElectronicsId,
        brandId: brandZenithId,
        name: 'Bluetooth Speaker',
        slug: `bluetooth-speaker-${randomUUID()}`,
        sku: 'SPK-1',
        basePrice: new Prisma.Decimal('50000'),
        status: ProductStatus.PUBLISHED,
        publishedAt: new Date(),
        inventory: { create: { quantity: 0, reserved: 0, trackInventory: false } },
      },
    });
    speakerId = speaker.id;

    const draft = await prisma.product.create({
      data: {
        merchantId: merchant1Id,
        categoryId: categoryGroceriesId,
        name: 'Unreleased Snack',
        slug: `unreleased-snack-${randomUUID()}`,
        basePrice: new Prisma.Decimal('1500'),
        status: ProductStatus.DRAFT,
      },
    });
    draftId = draft.id;

    const featured = await prisma.product.create({
      data: {
        merchantId: merchant2Id,
        categoryId: categoryElectronicsId,
        name: 'Smart Watch',
        slug: `smart-watch-${randomUUID()}`,
        sku: 'WATCH-1',
        basePrice: new Prisma.Decimal('30000'),
        status: ProductStatus.PUBLISHED,
        publishedAt: new Date(),
        isFeatured: true,
        inventory: { create: { quantity: 5, trackInventory: true } },
      },
    });
    featuredId = featured.id;

    await prisma.reviewAggregate.create({
      data: {
        targetType: ReviewTargetType.PRODUCT,
        targetId: riceId,
        averageRating: 4.5,
        reviewCount: 10,
      },
    });
    await prisma.reviewAggregate.create({
      data: {
        targetType: ReviewTargetType.PRODUCT,
        targetId: speakerId,
        averageRating: 3.0,
        reviewCount: 2,
      },
    });

    const customerId = userIds[0];
    if (!customerId) {
      throw new Error('expected at least one merchant user id to exist');
    }

    const order = await prisma.order.create({
      data: {
        customerId,
        merchantId: merchant2Id,
        orderNumber: `ORD-${randomUUID()}`,
        fulfillmentType: FulfillmentType.DELIVERY,
        subtotal: new Prisma.Decimal('50000'),
        total: new Prisma.Decimal('50000'),
        items: {
          create: [
            {
              productId: speakerId,
              merchantId: merchant2Id,
              quantity: 5,
              unitPrice: new Prisma.Decimal('50000'),
              subtotal: new Prisma.Decimal('250000'),
              snapshotName: 'Bluetooth Speaker',
            },
            {
              productId: riceId,
              merchantId: merchant1Id,
              quantity: 1,
              unitPrice: new Prisma.Decimal('1000'),
              subtotal: new Prisma.Decimal('1000'),
              snapshotName: 'Basmati Rice',
            },
          ],
        },
      },
    });
    void order;
  });

  afterAll(async () => {
    if (databaseAvailable) {
      for (const id of userIds) {
        await prisma.user.delete({ where: { id } }).catch(() => undefined);
      }
    }
    await prisma.$disconnect();
  });

  it('only returns published, non-deleted products', async () => {
    if (!databaseAvailable) return;
    const result = await service.browse({});
    const ids = result.items.map((item) => item.id);
    expect(ids).not.toContain(draftId);
    expect(ids).toContain(riceId);
  });

  it('filters by category', async () => {
    if (!databaseAvailable) return;
    const result = await service.browse({ categoryId: categoryElectronicsId });
    expect(result.items.every((item) => item.categoryId === categoryElectronicsId)).toBe(true);
    expect(result.items.map((item) => item.id)).toEqual(
      expect.arrayContaining([speakerId, featuredId]),
    );
  });

  it('filters by brand and merchant', async () => {
    if (!databaseAvailable) return;
    const byBrand = await service.browse({ brandId: brandAcmeId });
    expect(byBrand.items.every((item) => item.brandId === brandAcmeId)).toBe(true);

    const byMerchant = await service.browse({ merchantId: merchant2Id });
    expect(byMerchant.items.every((item) => item.merchantId === merchant2Id)).toBe(true);
  });

  it('filters by price range', async () => {
    if (!databaseAvailable) return;
    const result = await service.browse({ minPrice: 1500, maxPrice: 2500 });
    expect(result.items.map((item) => item.id)).toEqual([outOfStockId]);
  });

  it('filters by minimum rating, excluding products with no aggregate', async () => {
    if (!databaseAvailable) return;
    const result = await service.browse({ minRating: 4 });
    expect(result.items.map((item) => item.id)).toEqual([riceId]);
  });

  it('filters to in-stock products (tracked with quantity, or untracked)', async () => {
    if (!databaseAvailable) return;
    const result = await service.browse({ inStock: true });
    const ids = result.items.map((item) => item.id);
    expect(ids).toContain(riceId);
    expect(ids).toContain(speakerId);
    expect(ids).not.toContain(outOfStockId);
  });

  it('searches by product name, sku, brand, and category', async () => {
    if (!databaseAvailable) return;
    const byName = await service.browse({ q: 'basmati' });
    expect(byName.items.map((item) => item.id)).toContain(riceId);

    const bySku = await service.browse({ q: 'SPK-1' });
    expect(bySku.items.map((item) => item.id)).toContain(speakerId);

    const byBrand = await service.browse({ q: 'zenith' });
    expect(byBrand.items.map((item) => item.id)).toContain(speakerId);

    const byCategory = await service.browse({ q: 'groceries' });
    expect(byCategory.items.map((item) => item.id)).toEqual(
      expect.arrayContaining([riceId, outOfStockId]),
    );
  });

  it('searches by merchant business name', async () => {
    if (!databaseAvailable) return;
    const result = await service.browse({ q: 'ZenithElectronics' });
    expect(result.items.map((item) => item.id)).toEqual(
      expect.arrayContaining([speakerId, featuredId]),
    );
  });

  it('sorts by price ascending and descending', async () => {
    if (!databaseAvailable) return;
    const asc = await service.browse({ sort: 'price_asc', limit: 10 });
    const prices = asc.items.map((item) => item.basePrice);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));

    const desc = await service.browse({ sort: 'price_desc', limit: 10 });
    const pricesDesc = desc.items.map((item) => item.basePrice);
    expect(pricesDesc).toEqual([...pricesDesc].sort((a, b) => b - a));
  });

  it('sorts by rating descending', async () => {
    if (!databaseAvailable) return;
    const result = await service.browse({ sort: 'rating_desc', limit: 10 });
    const riceIndex = result.items.findIndex((item) => item.id === riceId);
    const draftLikeIndex = result.items.findIndex((item) => item.id === outOfStockId);
    expect(riceIndex).toBeGreaterThanOrEqual(0);
    expect(draftLikeIndex).toBeGreaterThan(riceIndex);
  });

  it('sorts by popularity using recent order item quantity', async () => {
    if (!databaseAvailable) return;
    const result = await service.browse({ sort: 'popular', limit: 10 });
    const speakerIndex = result.items.findIndex((item) => item.id === speakerId);
    const featuredIndex = result.items.findIndex((item) => item.id === featuredId);
    expect(speakerIndex).toBeGreaterThanOrEqual(0);
    expect(featuredIndex).toBeGreaterThan(speakerIndex);
  });

  it('forces isFeatured and sort overrides for preset endpoints', async () => {
    if (!databaseAvailable) return;
    const result = await service.browse({}, { isFeatured: true, forceSort: 'newest' });
    expect(result.items.map((item) => item.id)).toEqual([featuredId]);
  });

  it('paginates with an opaque cursor across pages', async () => {
    if (!databaseAvailable) return;
    const page1 = await service.browse({ sort: 'price_asc', limit: 1 });
    expect(page1.items).toHaveLength(1);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await service.browse({
      sort: 'price_asc',
      limit: 1,
      ...(page1.nextCursor ? { cursor: page1.nextCursor } : {}),
    });
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0]?.id).not.toBe(page1.items[0]?.id);
  });

  it('returns full product detail with merchant summary, rating, and related products', async () => {
    if (!databaseAvailable) return;
    const detail = await service.getProductDetail(riceId);

    expect(detail.name).toBe('Basmati Rice');
    expect(detail.images).toHaveLength(1);
    expect(detail.inStock).toBe(true);
    expect(detail.merchant).toMatchObject({ businessName: 'AcmeMart' });
    expect(detail.rating).toMatchObject({ average: 4.5, count: 10 });
    expect(detail.relatedProducts.map((item) => item.id)).toContain(outOfStockId);
    expect(detail.relatedProducts.map((item) => item.id)).not.toContain(riceId);
  });

  it('throws not found for a draft or nonexistent product', async () => {
    if (!databaseAvailable) return;
    await expect(service.getProductDetail(draftId)).rejects.toThrow(NotFoundDomainException);
    await expect(service.getProductDetail(randomUUID())).rejects.toThrow(NotFoundDomainException);
  });

  it('lists similar products by shared category, excluding itself', async () => {
    if (!databaseAvailable) return;
    const similar = await service.listSimilar(speakerId);
    const ids = similar.map((item) => item.id);
    expect(ids).toContain(featuredId);
    expect(ids).not.toContain(speakerId);
  });

  it('lists only active categories and brands, sorted by name', async () => {
    if (!databaseAvailable) return;
    const categories = await service.listCategories();
    const names = categories.map((category) => category.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(categories.every((category) => category.isActive)).toBe(true);

    const brands = await service.listBrands();
    expect(brands.every((brand) => brand.isActive)).toBe(true);
  });
});
