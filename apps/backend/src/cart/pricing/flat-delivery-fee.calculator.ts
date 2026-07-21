import { Inject, Injectable } from '@nestjs/common';

import { DEFAULT_FLAT_DELIVERY_FEE } from '../cart.constants';

import {
  FLAT_DELIVERY_FEE,
  type DeliveryFeeCalculator,
  type DeliveryFeeContext,
} from './delivery-fee-calculator';

/**
 * Flat delivery fee calculator.
 * Replace with distance-based pricing later without changing CartService.
 */
@Injectable()
export class FlatDeliveryFeeCalculator implements DeliveryFeeCalculator {
  constructor(
    @Inject(FLAT_DELIVERY_FEE) private readonly flatFee: number = DEFAULT_FLAT_DELIVERY_FEE,
  ) {}

  public calculateFee(_context: DeliveryFeeContext): Promise<number> {
    return Promise.resolve(roundMoney(this.flatFee));
  }
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
