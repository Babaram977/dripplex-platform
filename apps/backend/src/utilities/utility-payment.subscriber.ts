import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS, type DomainEvent } from '../events/domain-events';

import { UtilitiesService } from './utilities.service';

/**
 * Completes a card-paid utility purchase from the gateway webhook.
 *
 * The card path used to depend entirely on the customer returning to the app
 * to call `POST purchase/:id/confirm`. A customer who stops at the gateway's
 * success page never calls it, so the money was taken and the purchase stayed
 * AWAITING_PAYMENT — which is exactly what happened to a ₦1,000 airtime
 * purchase on 2026-08-19. The webhook does not depend on the customer, so it
 * is the reliable trigger; the return-to-app confirm stays as the fast path
 * and both are safe to run because confirmCardPurchase is idempotent.
 *
 * PaymentService cannot call UtilitiesService directly — UtilitiesModule
 * already imports PaymentsModule — so this goes over the event bus, the same
 * way OrderReadySubscriber bridges orders to delivery.
 */
@Injectable()
export class UtilityPaymentSubscriber implements OnModuleInit {
  private readonly logger = new Logger(UtilityPaymentSubscriber.name);

  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly utilitiesService: UtilitiesService,
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
      // The lookup is by the unique paymentReference, so a reference that
      // belongs to a wallet top-up or a ride simply misses and returns null.
      const purchase = await this.utilitiesService.completeCardPurchaseByReference(reference, {});
      if (purchase) {
        this.logger.log(
          `Utility purchase ${purchase.id} settled from webhook (${purchase.status})`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to settle utility purchase for ${reference}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
