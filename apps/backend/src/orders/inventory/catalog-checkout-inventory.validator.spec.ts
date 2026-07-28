import { ProductStatus } from '@prisma/client';

import { ProductsService, type ResolvedCatalogItem } from '../../products/products.service';

import { CatalogCheckoutInventoryValidator } from './catalog-checkout-inventory.validator';

describe('CatalogCheckoutInventoryValidator', () => {
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
    availableQuantity: 5,
  };

  function buildValidator(
    entries: Map<string, ResolvedCatalogItem>,
  ): CatalogCheckoutInventoryValidator {
    const productsService = new ProductsService({} as never);
    jest.spyOn(productsService, 'resolveMany').mockResolvedValue(entries);
    return new CatalogCheckoutInventoryValidator(productsService);
  }

  it('throws for a product that does not exist', async () => {
    const validator = buildValidator(new Map());
    await expect(
      validator.assertAvailable([{ productId: 'ghost', quantity: 1 }]),
    ).rejects.toThrow('Product ghost is not available');
  });

  it('throws for an unpublished product', async () => {
    const validator = buildValidator(new Map([['p1:', { ...published, status: ProductStatus.DRAFT }]]));
    await expect(
      validator.assertAvailable([{ productId: 'p1', quantity: 1 }]),
    ).rejects.toThrow('Product p1 is not available');
  });

  it('throws for insufficient tracked stock', async () => {
    const validator = buildValidator(new Map([['p1:', { ...published, availableQuantity: 1 }]]));
    await expect(
      validator.assertAvailable([{ productId: 'p1', quantity: 5 }]),
    ).rejects.toThrow('Insufficient stock for product p1');
  });

  it('resolves without error for an available, in-stock product', async () => {
    const validator = buildValidator(new Map([['p1:', published]]));
    await expect(
      validator.assertAvailable([{ productId: 'p1', quantity: 2 }]),
    ).resolves.toBeUndefined();
  });
});
