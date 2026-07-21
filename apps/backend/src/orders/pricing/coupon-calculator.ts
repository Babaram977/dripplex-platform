import { Injectable } from '@nestjs/common';

export abstract class CouponCalculator {
  public abstract calculate(input: {
    subtotal: number;
    couponCode?: string | null;
    currency: string;
  }):
    | Promise<{ discount: number; couponCode: string | null }>
    | {
        discount: number;
        couponCode: string | null;
      };
}

/** Default: no coupon discount until promotions exist. */
@Injectable()
export class ZeroCouponCalculator extends CouponCalculator {
  public calculate(input: { subtotal: number; couponCode?: string | null; currency: string }): {
    discount: number;
    couponCode: string | null;
  } {
    const code = input.couponCode?.trim();
    return {
      discount: 0,
      couponCode: code && code.length > 0 ? code : null,
    };
  }
}
