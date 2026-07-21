import { Injectable } from '@nestjs/common';

import type { CouponContext, CouponEngine } from './coupon-engine';

/**
 * Default coupon engine — always returns zero discount.
 * Replace with a real promotions engine later.
 */
@Injectable()
export class NoCouponEngine implements CouponEngine {
  public applyDiscount(_context: CouponContext): Promise<number> {
    return Promise.resolve(0);
  }
}
