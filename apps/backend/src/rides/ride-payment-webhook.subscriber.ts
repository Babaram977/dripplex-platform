import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS, type DomainEvent } from '../events/domain-events';

import { RidePaymentService } from './ride-payment.service';

/**
 * Settles a card-paid fare from the gateway webhook.
 *
 * The third of the three payment paths that only ever settled when the
 * customer came back to the app — see UtilityPaymentSubscriber for how that
 * failed in production. RidePaymentService now claims the transaction row
 * atomically, so the webhook and the return-to-app verify race safely.
 */
@Injectable()
export class RidePaymentWebhookSubscriber implements OnModuleInit {
  private readonly logger = new Logger(RidePaymentWebhookSubscriber.name);

  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly ridePaymentService: RidePaymentService,
  ) {}

  public onModuleInit(): void {
    this.eventBus.on(DOMAIN_EVENTS.PAYMENT_WEBHOOK_UNMATCHED, (event) => this.handle(event));
  }

  public async handle(event: DomainEvent): Promise<void> {
    const reference = event.payload['reference'];
    if (typeof reference !== 'string' || event.payload['success'] !== true) {
      return;
    }

    try {
      // Looked up by the unique providerReference, so a wallet top-up or
      // utility reference simply misses and returns null.
      const ride = await this.ridePaymentService.completeGatewayPaymentByReference(reference, {});
      if (ride) {
        this.logger.log(`Ride ${ride.id} settled from webhook (${ride.paymentStatus})`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to settle ride payment ${reference}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
