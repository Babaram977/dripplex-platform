export interface CouponContext {
  customerId: string;
  merchantId: string;
  subtotal: number;
  currency: string;
  couponCode?: string;
}

export interface CouponEngine {
  applyDiscount(context: CouponContext): Promise<number>;
}

export const COUPON_ENGINE = Symbol('COUPON_ENGINE');
