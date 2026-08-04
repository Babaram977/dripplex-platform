import { Injectable } from '@nestjs/common';

import { PromotionsService } from '../promotions/promotions.service';

import { DEFAULT_FLAT_DELIVERY_FEE, DEFAULT_VAT_RATE } from './pricing.constants';

export type PricingFulfillmentType = 'PICKUP' | 'DELIVERY';

export interface ComputeTotalsInput {
  subtotal: number;
  customerId: string;
  merchantId?: string;
  couponCode?: string;
  /** Checkout always knows this; Cart preview doesn't (fulfillment is
   * chosen at checkout) and omits it, which is treated as `DELIVERY` —
   * matching Cart's existing always-show-a-delivery-fee preview, which the
   * checkout page already nets to zero for pickup on the client side. */
  fulfillmentType?: PricingFulfillmentType;
}

export interface ComputedTotals {
  subtotal: number;
  discount: number;
  tax: number;
  deliveryFee: number;
  total: number;
  couponCode: string | null;
}

/** The single source of truth for Marketplace pricing. Cart preview
 * (`CartService.recalculateInternal`) and order creation
 * (`CheckoutService.checkout`) both call `computeTotals` with the same
 * inputs they each have available, so the "Final Total" a customer sees
 * is guaranteed to be the amount the Order is created (and therefore
 * charged, via Wallet/Paystack/Flutterwave/OPay/Cash — all of which read
 * `order.total`) for. Previously Cart and Checkout each independently
 * recomputed subtotal/discount/tax/deliveryFee from scratch, and Checkout
 * used permanent zero-stub calculators disconnected from Cart's real VAT
 * and delivery-fee logic — so a checkout could display one total and
 * charge a lower one. See docs/MARKETPLACE-006-CASH-WALLET-PAYMENT-DESIGN.md
 * for how this was discovered. */
@Injectable()
export class PricingService {
  constructor(private readonly promotions: PromotionsService) {}

  public async computeTotals(input: ComputeTotalsInput): Promise<ComputedTotals> {
    const subtotal = this.roundMoney(input.subtotal);

    const evaluation = await this.promotions.evaluateForCart({
      subtotal,
      userId: input.customerId,
      ...(input.merchantId !== undefined ? { merchantId: input.merchantId } : {}),
      ...(input.couponCode?.trim() ? { couponCode: input.couponCode.trim() } : {}),
    });
    const discount = this.roundMoney(Math.min(evaluation.discountTotal, subtotal));
    const couponCode = discount > 0 ? evaluation.couponCode : null;

    const tax = this.roundMoney(Math.max(0, subtotal - discount) * DEFAULT_VAT_RATE);

    const deliveryFee =
      subtotal === 0 || input.fulfillmentType === 'PICKUP' ? 0 : DEFAULT_FLAT_DELIVERY_FEE;

    const total = this.roundMoney(Math.max(0, subtotal - discount + tax + deliveryFee));

    return { subtotal, discount, tax, deliveryFee, total, couponCode };
  }

  private roundMoney(amount: number): number {
    return Math.round((amount + Number.EPSILON) * 100) / 100;
  }
}
