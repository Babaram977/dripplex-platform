import { Injectable } from '@nestjs/common';

/**
 * Confirms sellable quantity before reservation.
 * Catalog inventory will replace the stub.
 */
export abstract class CheckoutInventoryValidator {
  public abstract assertAvailable(
    items: {
      productId: string;
      variantId?: string | null;
      quantity: number;
    }[],
  ): Promise<void>;
}

export const CHECKOUT_INVENTORY_VALIDATOR = Symbol('CHECKOUT_INVENTORY_VALIDATOR');

@Injectable()
export class AlwaysAvailableCheckoutInventoryValidator extends CheckoutInventoryValidator {
  public assertAvailable(): Promise<void> {
    return Promise.resolve();
  }
}
