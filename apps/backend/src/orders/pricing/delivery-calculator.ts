import { Injectable } from '@nestjs/common';

import type { FulfillmentType } from '@prisma/client';

export abstract class DeliveryCalculator {
  public abstract calculate(input: {
    subtotal: number;
    fulfillmentType: FulfillmentType;
    currency: string;
  }): Promise<number> | number;
}

/** Default: no delivery fee until logistics rules are configured. */
@Injectable()
export class ZeroDeliveryCalculator extends DeliveryCalculator {
  public calculate(): number {
    return 0;
  }
}
