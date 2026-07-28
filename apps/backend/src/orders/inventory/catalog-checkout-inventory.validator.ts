import { Injectable } from '@nestjs/common';

import { ValidationDomainException } from '../../common/exceptions/domain.exception';
import { ProductsService } from '../../products/products.service';

import { CheckoutInventoryValidator } from './checkout-inventory.validator';

/**
 * Confirms sellable quantity against the real product catalog before
 * inventory reservation.
 */
@Injectable()
export class CatalogCheckoutInventoryValidator extends CheckoutInventoryValidator {
  constructor(private readonly productsService: ProductsService) {
    super();
  }

  public async assertAvailable(
    items: { productId: string; variantId?: string | null; quantity: number }[],
  ): Promise<void> {
    const resolved = await this.productsService.resolveMany(items);

    for (const item of items) {
      const entry = resolved.get(this.productsService.key(item.productId, item.variantId ?? null));
      if (!entry) {
        throw new ValidationDomainException(`Product ${item.productId} is not available`);
      }
      if (!this.productsService.isSellable(entry)) {
        throw new ValidationDomainException(`Product ${item.productId} is not available`);
      }
      if (!this.productsService.hasStock(entry, item.quantity)) {
        throw new ValidationDomainException(`Insufficient stock for product ${item.productId}`);
      }
    }
  }
}
