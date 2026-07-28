import { Injectable } from '@nestjs/common';

import { ProductsService } from '../../products/products.service';

import type { InventoryCheckInput, InventoryCheckResult, InventoryValidator } from './inventory-validator';

/**
 * Validates cart additions against the real product catalog: existence,
 * merchant ownership, publish status, and tracked stock.
 */
@Injectable()
export class CatalogInventoryValidator implements InventoryValidator {
  constructor(private readonly productsService: ProductsService) {}

  public async validateAvailability(input: InventoryCheckInput): Promise<InventoryCheckResult> {
    const entry = await this.productsService.resolveOne({
      productId: input.productId,
      variantId: input.variantId ?? null,
    });

    if (!entry) {
      return { available: false, reason: 'Product not found' };
    }
    if (entry.merchantId !== input.merchantId) {
      return { available: false, reason: 'Product does not belong to this merchant' };
    }
    if (!this.productsService.isSellable(entry)) {
      return { available: false, reason: 'Product is not available' };
    }
    if (!this.productsService.hasStock(entry, input.quantity)) {
      return { available: false, reason: 'Insufficient stock' };
    }

    return { available: true };
  }
}
