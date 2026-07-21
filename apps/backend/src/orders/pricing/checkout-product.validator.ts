import { Injectable } from '@nestjs/common';

export interface CheckoutProductSnapshot {
  productId: string;
  variantId: string | null;
  merchantId: string;
  name: string;
  sku: string | null;
  imageUrl: string | null;
  unitPrice: number;
  active: boolean;
  deleted: boolean;
}

/**
 * Resolves product snapshots for order line items.
 * Catalog module will replace the stub implementation.
 */
export abstract class CheckoutProductValidator {
  public abstract resolve(
    items: {
      productId: string;
      variantId?: string | null;
      unitPrice: number;
    }[],
  ): Promise<CheckoutProductSnapshot[]>;
}

export const CHECKOUT_PRODUCT_VALIDATOR = Symbol('CHECKOUT_PRODUCT_VALIDATOR');

@Injectable()
export class StubCheckoutProductValidator extends CheckoutProductValidator {
  public resolve(
    items: {
      productId: string;
      variantId?: string | null;
      unitPrice: number;
    }[],
  ): Promise<CheckoutProductSnapshot[]> {
    return Promise.resolve(
      items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId ?? null,
        merchantId: 'stub-merchant',
        name: `Product ${item.productId}`,
        sku: item.variantId ? `SKU-${item.variantId}` : `SKU-${item.productId}`,
        imageUrl: null,
        unitPrice: item.unitPrice,
        active: true,
        deleted: false,
      })),
    );
  }
}
