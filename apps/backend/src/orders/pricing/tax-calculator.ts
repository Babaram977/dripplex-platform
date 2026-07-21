import { Injectable } from '@nestjs/common';

export abstract class TaxCalculator {
  public abstract calculate(input: {
    subtotal: number;
    discount: number;
    currency: string;
  }): Promise<number> | number;
}

/** Default: no tax until tax rules are configured (S1 later). */
@Injectable()
export class ZeroTaxCalculator extends TaxCalculator {
  public calculate(): number {
    return 0;
  }
}
