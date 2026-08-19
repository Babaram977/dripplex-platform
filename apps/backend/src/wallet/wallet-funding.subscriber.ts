import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS, type DomainEvent } from '../events/domain-events';

import { WalletFundingService } from './wallet-funding.service';

/**
 * Credits a card top-up from the gateway webhook.
 *
 * Same failure as the utility card path: the top-up was only ever settled by
 * the customer returning to the app, so a customer who stopped at the
 * gateway's success page paid and was never credited. The webhook does not
 * depend on the customer. Both paths now run through the same atomic claim in
 * WalletFundingService, so whichever arrives first credits and the other is a
 * no-op.
 */
@Injectable()
export class WalletFundingSubscriber implements OnModuleInit {
  private readonly logger = new Logger(WalletFundingSubscriber.name);

  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly fundingService: WalletFundingService,
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
      // Looked up by the unique providerReference, so a reference belonging to
      // a ride or a utility purchase simply misses and returns null.
      const wallet = await this.fundingService.completeFundingByReference(reference, {});
      if (wallet) {
        this.logger.log(`Wallet top-up ${reference} credited from webhook`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to credit wallet top-up ${reference}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
