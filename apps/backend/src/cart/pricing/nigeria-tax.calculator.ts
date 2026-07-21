import { Inject, Injectable } from '@nestjs/common';

import { DEFAULT_VAT_RATE } from '../cart.constants';

import { VAT_RATE, type TaxCalculator, type TaxContext } from './tax-calculator';

/**
 * Nigeria VAT calculator — applies configurable VAT to (subtotal - discount).
 */
@Injectable()
export class NigeriaTaxCalculator implements TaxCalculator {
  constructor(@Inject(VAT_RATE) private readonly vatRate: number = DEFAULT_VAT_RATE) {}

  public calculateTax(context: TaxContext): Promise<number> {
    const taxable = Math.max(0, context.subtotal - context.discount);
    const tax = roundMoney(taxable * this.vatRate);
    return Promise.resolve(tax);
  }
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
