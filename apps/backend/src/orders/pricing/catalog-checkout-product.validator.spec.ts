import { ProductStatus } from '@prisma/client';

import { ProductsService, type ResolvedCatalogItem } from '../../products/products.service';

import { CatalogCheckoutProductValidator } from './catalog-checkout-product.validator';

describe('CatalogCheckoutProductValidator', () => {
  function buildValidator(
    entries: Map<string, ResolvedCatalogItem>,
  ): CatalogCheckoutProductValidator {
    const productsService = new ProductsService({} as never);
    jest.spyOn(productsService, 'resolveMany').mockResolvedValue(entries);
    return new CatalogCheckoutProductValidator(productsService);
  }

  it('marks a missing product as deleted and inactive', async () => {
    const validator = buildValidator(new Map());
    const [snapshot] = await validator.resolve([{ productId: 'ghost', unitPrice: 50 }]);

    expect(snapshot).toMatchObject({
      productId: 'ghost',
      deleted: true,
      active: false,
      unitPrice: 50,
    });
  });

  it('resolves an active snapshot for a published product', async () => {
    const entry: ResolvedCatalogItem = {
      productId: 'p1',
      variantId: null,
      merchantId: 'm1',
      name: 'Rice',
      sku: 'RICE-SKU',
      imageUrl: 'https://example.com/rice.jpg',
      unitPrice: 4500,
      status: ProductStatus.PUBLISHED,
      isDeleted: false,
      trackInventory: true,
      manuallyDisabled: false,
      availableQuantity: 10,
    };
    const validator = buildValidator(new Map([['p1:', entry]]));

    const [snapshot] = await validator.resolve([{ productId: 'p1', unitPrice: 4500 }]);

    expect(snapshot).toMatchObject({
      productId: 'p1',
      merchantId: 'm1',
      name: 'Rice',
      sku: 'RICE-SKU',
      imageUrl: 'https://example.com/rice.jpg',
      active: true,
      deleted: false,
    });
  });

  it('marks a draft product as inactive but not deleted', async () => {
    const entry: ResolvedCatalogItem = {
      productId: 'p1',
      variantId: null,
      merchantId: 'm1',
      name: 'Rice',
      sku: null,
      imageUrl: null,
      unitPrice: 4500,
      status: ProductStatus.DRAFT,
      isDeleted: false,
      trackInventory: false,
      manuallyDisabled: false,
      availableQuantity: null,
    };
    const validator = buildValidator(new Map([['p1:', entry]]));

    const [snapshot] = await validator.resolve([{ productId: 'p1', unitPrice: 4500 }]);

    expect(snapshot).toMatchObject({ active: false, deleted: false });
  });
});
