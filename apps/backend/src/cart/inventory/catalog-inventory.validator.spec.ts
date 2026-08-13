import { ProductStatus } from '@prisma/client';

import { CatalogInventoryValidator } from './catalog-inventory.validator';

import type { ProductsService, ResolvedCatalogItem } from '../../products/products.service';

describe('CatalogInventoryValidator', () => {
  const published: ResolvedCatalogItem = {
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
    availableQuantity: 5,
  };

  function buildValidator(entry: ResolvedCatalogItem | null): CatalogInventoryValidator {
    const productsService = {
      resolveOne: jest.fn().mockResolvedValue(entry),
      isSellable: jest.fn(
        (item: ResolvedCatalogItem) => item.status === ProductStatus.PUBLISHED && !item.isDeleted,
      ),
      hasStock: jest.fn(
        (item: ResolvedCatalogItem, quantity: number) =>
          !item.trackInventory || (item.availableQuantity ?? 0) >= quantity,
      ),
    } as unknown as ProductsService;
    return new CatalogInventoryValidator(productsService);
  }

  it('rejects a product that does not exist', async () => {
    const validator = buildValidator(null);
    const result = await validator.validateAvailability({
      merchantId: 'm1',
      productId: 'p1',
      quantity: 1,
    });
    expect(result).toEqual({ available: false, reason: 'Product not found' });
  });

  it('rejects a product owned by a different merchant', async () => {
    const validator = buildValidator(published);
    const result = await validator.validateAvailability({
      merchantId: 'someone-else',
      productId: 'p1',
      quantity: 1,
    });
    expect(result).toEqual({
      available: false,
      reason: 'Product does not belong to this merchant',
    });
  });

  it('rejects an unpublished product', async () => {
    const validator = buildValidator({ ...published, status: ProductStatus.DRAFT });
    const result = await validator.validateAvailability({
      merchantId: 'm1',
      productId: 'p1',
      quantity: 1,
    });
    expect(result).toEqual({ available: false, reason: 'Product is not available' });
  });

  it('rejects insufficient tracked stock', async () => {
    const validator = buildValidator({ ...published, availableQuantity: 1 });
    const result = await validator.validateAvailability({
      merchantId: 'm1',
      productId: 'p1',
      quantity: 5,
    });
    expect(result).toEqual({ available: false, reason: 'Insufficient stock' });
  });

  it('allows an available, published, in-stock product', async () => {
    const validator = buildValidator(published);
    const result = await validator.validateAvailability({
      merchantId: 'm1',
      productId: 'p1',
      quantity: 2,
    });
    expect(result).toEqual({ available: true });
  });
});
