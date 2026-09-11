import { Injectable, OnModuleInit } from '@nestjs/common';
import { LoyaltyEarnerPersona, RideRatingRole } from '@prisma/client';

import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS, type DomainEvent } from '../events/domain-events';

import { LoyaltyEarningService } from './loyalty-earning.service';
import { LOYALTY_REFERENCE_TYPES } from './loyalty.constants';

/**
 * DPX-LOYALTY-007 — partners earning DX Points, where a programme allows it.
 *
 * Separate from `LoyaltyEventsSubscriber`, which is the customer side, because
 * the two answer to different rules: a customer earns by default, a partner
 * earns only under an approved programme. Keeping them apart means neither
 * can accidentally inherit the other's rule.
 *
 * Note that one order can pay two different people — its customer on
 * `ORDER_PAID` and its merchant on `ORDER_COMPLETED` — and both awards are
 * keyed on the same order id. They use different reference types so neither
 * looks like a replay of the other.
 */
@Injectable()
export class LoyaltyPartnerEarningSubscriber implements OnModuleInit {
  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly earning: LoyaltyEarningService,
  ) {}

  public onModuleInit(): void {
    this.eventBus.on(DOMAIN_EVENTS.RIDE_COMPLETED, (event) => this.handleRideCompleted(event));
    this.eventBus.on(DOMAIN_EVENTS.DELIVERY_COMPLETED, (event) =>
      this.handleDeliveryCompleted(event),
    );
    this.eventBus.on(DOMAIN_EVENTS.ORDER_COMPLETED, (event) => this.handleOrderCompleted(event));
    this.eventBus.on(DOMAIN_EVENTS.RIDE_RATED, (event) => this.handleRideRated(event));
  }

  private async handleRideCompleted(event: DomainEvent): Promise<void> {
    const driverId = stringPayload(event, 'driverId');
    const rideId = stringPayload(event, 'rideId');
    if (!driverId || !rideId) {
      return;
    }
    await this.earning.awardForCompletedJob({
      persona: LoyaltyEarnerPersona.DRIVER,
      userId: driverId,
      referenceType: LOYALTY_REFERENCE_TYPES.PARTNER_RIDE,
      referenceId: rideId,
    });
  }

  private async handleDeliveryCompleted(event: DomainEvent): Promise<void> {
    const riderId = stringPayload(event, 'riderId');
    const deliveryJobId = stringPayload(event, 'deliveryJobId');
    if (!riderId || !deliveryJobId) {
      return;
    }
    await this.earning.awardForCompletedJob({
      persona: LoyaltyEarnerPersona.RIDER,
      userId: riderId,
      referenceType: LOYALTY_REFERENCE_TYPES.PARTNER_DELIVERY,
      referenceId: deliveryJobId,
    });
  }

  private async handleOrderCompleted(event: DomainEvent): Promise<void> {
    const merchantId = stringPayload(event, 'merchantId');
    const orderId = stringPayload(event, 'orderId');
    if (!merchantId || !orderId) {
      return;
    }
    await this.earning.awardForCompletedJob({
      persona: LoyaltyEarnerPersona.MERCHANT,
      userId: merchantId,
      referenceType: LOYALTY_REFERENCE_TYPES.PARTNER_ORDER,
      referenceId: orderId,
    });
  }

  /**
   * A good review pays the driver points. It does not, and cannot, move their
   * star rating — founder decision, 2026-09-11.
   *
   * Only a customer's rating of a driver counts. A driver rating their
   * passenger is the other direction entirely, and paying a driver points for
   * rating somebody would reward the act of rating rather than the service.
   */
  private async handleRideRated(event: DomainEvent): Promise<void> {
    if (stringPayload(event, 'raterRole') !== RideRatingRole.CUSTOMER) {
      return;
    }
    const rateeId = stringPayload(event, 'rateeId');
    const ratingId = stringPayload(event, 'ratingId');
    const rating = Number(stringPayload(event, 'rating') ?? '');
    if (!rateeId || !ratingId || !Number.isFinite(rating)) {
      return;
    }

    await this.earning.awardForReview({
      persona: LoyaltyEarnerPersona.DRIVER,
      userId: rateeId,
      rating,
      referenceType: LOYALTY_REFERENCE_TYPES.PARTNER_REVIEW,
      referenceId: ratingId,
    });
  }
}

function stringPayload(event: DomainEvent, key: string): string | undefined {
  const value = event.payload[key];
  return typeof value === 'string' ? value : undefined;
}
