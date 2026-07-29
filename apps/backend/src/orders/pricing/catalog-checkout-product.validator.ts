import { Injectable } from '@nestjs/common';

import { ProductsService } from '../../products/products.service';

import { CheckoutProductValidator, type CheckoutProductSnapshot } from './checkout-product.validator';

/**
 * Resolves order line-item snapshots against the real product catalog.
 * Products that no longer exist are treated as deleted; unpublished
 * products are treated as inactive — both block checkout.
 */
@Injectable()
export class CatalogCheckoutProductValidator extends CheckoutProductValidator {
  constructor(private readonly productsService: ProductsService) {
    super();
  }

  public async resolve(
    items: { productId: string; variantId?: string | null; unitPrice: number }[],
  ): Promise<CheckoutProductSnapshot[]> {
    const resolved = await this.productsService.resolveMany(items);

    return items.map((item) => {
      const entry = resolved.get(this.productsService.key(item.productId, item.variantId ?? null));

      if (!entry) {
        return {
          productId: item.productId,
          variantId: item.variantId ?? null,
          merchantId: '',
          name: `Product ${item.productId}`,
          sku: null,
          imageUrl: null,
          unitPrice: item.unitPrice,
          active: false,
          deleted: true,
        };
      }

      return {
        productId: entry.productId,
        variantId: entry.variantId,
        merchantId: entry.merchantId,
        name: entry.name,
        sku: entry.sku,
        imageUrl: entry.imageUrl,
        unitPrice: entry.unitPrice,
        active: this.productsService.isSellable(entry),
        deleted: entry.isDeleted,
      };
    });
  }
}
