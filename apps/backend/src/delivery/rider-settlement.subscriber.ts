import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS, type DomainEvent } from '../events/domain-events';

import { RiderSettlementService } from './rider-settlement.service';

/**
 * DPX-RIDER-006 — pays the rider once a delivery is finished.
 *
 * Bound to both completion events, mirroring how the merchant side already
 * splits them:
 *
 *   • DELIVERY_COMPLETED       — the handoff. Settles a PREPAID delivery,
 *                                where DrippleX holds the money.
 *   • DELIVERY_CASH_CONFIRMED  — the rider's explicit confirmation that they
 *                                took the cash. Settles a CASH delivery.
 *
 * Both are safe to fire for either mode: settleDelivery() reads the order's
 * payment method itself and is idempotent, so whichever event lands first
 * settles the job and the other is a no-op. That matters because a cash
 * delivery emits BOTH events.
 */
@Injectable()
export class RiderSettlementSubscriber implements OnModuleInit {
  private readonly logger = new Logger(RiderSettlementSubscriber.name);

  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly riderSettlement: RiderSettlementService,
  ) {}

  public onModuleInit(): void {
    this.eventBus.on(DOMAIN_EVENTS.DELIVERY_CASH_CONFIRMED, (event) => this.handle(event));
    this.eventBus.on(DOMAIN_EVENTS.DELIVERY_COMPLETED, (event) => this.handle(event));
  }

  public async handle(event: DomainEvent): Promise<void> {
    const deliveryJobId = event.payload['deliveryJobId'];
    if (typeof deliveryJobId !== 'string') {
      return;
    }
    try {
      await this.riderSettlement.settleDelivery(deliveryJobId, {
        ...(typeof event.payload['riderId'] === 'string'
          ? { userId: event.payload['riderId'] }
          : {}),
      });
    } catch (error) {
      // A settlement failure must not roll back the delivery itself — the
      // rider has already handed the parcel over. Log loudly; the job stays
      // unsettled and can be settled again.
      this.logger.error(
        `Failed to settle delivery ${deliveryJobId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
