import { ProductStatus } from '@prisma/client';

import { ProductsService } from './products.service';

import type { PrismaService } from '../prisma/prisma.service';

describe('ProductsService', () => {
  const prisma = {
    product: {
      findMany: jest.fn(),
    },
  } as unknown as PrismaService;

  const service = new ProductsService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an empty map when given no items', async () => {
    const result = await service.resolveMany([]);
    expect(result.size).toBe(0);
    expect(prisma.product.findMany).not.toHaveBeenCalled();
  });

  it('resolves a base product with no variant', async () => {
    (prisma.product.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'p1',
        merchantId: 'm1',
        name: 'Rice',
        sku: 'RICE-SKU',
        basePrice: 4500,
        status: ProductStatus.PUBLISHED,
        isDeleted: false,
        variants: [],
        inventory: { quantity: 10, reserved: 2, trackInventory: true },
        images: [{ url: 'https://example.com/rice.jpg' }],
      },
    ]);

    const entry = await service.resolveOne({ productId: 'p1' });

    expect(entry).toMatchObject({
      productId: 'p1',
      variantId: null,
      merchantId: 'm1',
      name: 'Rice',
      sku: 'RICE-SKU',
      imageUrl: 'https://example.com/rice.jpg',
      unitPrice: 4500,
      status: ProductStatus.PUBLISHED,
      trackInventory: true,
      availableQuantity: 8,
    });
  });

  it('resolves a variant, preferring its name, sku, and price override', async () => {
    (prisma.product.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'p1',
        merchantId: 'm1',
        name: 'Rice',
        sku: 'RICE-SKU',
        basePrice: 4500,
        status: ProductStatus.PUBLISHED,
        isDeleted: false,
        variants: [{ id: 'v1', name: '10kg Bag', sku: 'RICE-10KG', priceOverride: 8000 }],
        inventory: null,
        images: [],
      },
    ]);

    const entry = await service.resolveOne({ productId: 'p1', variantId: 'v1' });

    expect(entry).toMatchObject({
      productId: 'p1',
      variantId: 'v1',
      name: 'Rice - 10kg Bag',
      sku: 'RICE-10KG',
      unitPrice: 8000,
      trackInventory: false,
      availableQuantity: null,
    });
  });

  it('returns null for a product that does not exist', async () => {
    (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
    const entry = await service.resolveOne({ productId: 'missing' });
    expect(entry).toBeNull();
  });

  it('treats untracked inventory as always in stock', () => {
    const entry = {
      productId: 'p1',
      variantId: null,
      merchantId: 'm1',
      name: 'Rice',
      sku: null,
      imageUrl: null,
      unitPrice: 100,
      status: ProductStatus.PUBLISHED,
      isDeleted: false,
      trackInventory: false,
      manuallyDisabled: false,
      availableQuantity: null,
    };
    expect(service.hasStock(entry, 999)).toBe(true);
  });

  it('rejects tracked inventory below the requested quantity', () => {
    const entry = {
      productId: 'p1',
      variantId: null,
      merchantId: 'm1',
      name: 'Rice',
      sku: null,
      imageUrl: null,
      unitPrice: 100,
      status: ProductStatus.PUBLISHED,
      isDeleted: false,
      trackInventory: true,
      manuallyDisabled: false,
      availableQuantity: 3,
    };
    expect(service.hasStock(entry, 4)).toBe(false);
    expect(service.hasStock(entry, 3)).toBe(true);
  });

  it('treats a manually-disabled product as out of stock and not sellable', () => {
    const entry = {
      productId: 'p1',
      variantId: null,
      merchantId: 'm1',
      name: 'Rice',
      sku: null,
      imageUrl: null,
      unitPrice: 100,
      status: ProductStatus.PUBLISHED,
      isDeleted: false,
      trackInventory: false,
      manuallyDisabled: true,
      availableQuantity: null,
    };
    // Untracked would normally be "always in stock", but the merchant's manual
    // out-of-stock switch overrides that and also blocks the sale.
    expect(service.hasStock(entry, 1)).toBe(false);
    expect(service.isSellable(entry)).toBe(false);
  });

  it('treats draft or deleted products as not sellable', () => {
    const draft = {
      productId: 'p1',
      variantId: null,
      merchantId: 'm1',
      name: 'Rice',
      sku: null,
      imageUrl: null,
      unitPrice: 100,
      status: ProductStatus.DRAFT,
      isDeleted: false,
      trackInventory: false,
      manuallyDisabled: false,
      availableQuantity: null,
    };
    const deleted = { ...draft, status: ProductStatus.PUBLISHED, isDeleted: true };
    const published = { ...draft, status: ProductStatus.PUBLISHED };

    expect(service.isSellable(draft)).toBe(false);
    expect(service.isSellable(deleted)).toBe(false);
    expect(service.isSellable(published)).toBe(true);
  });
});
