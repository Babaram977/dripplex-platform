import { Injectable, OnModuleInit } from '@nestjs/common';

import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS, type DomainEvent } from '../events/domain-events';

@Injectable()
export class WalletEventsSubscriber implements OnModuleInit {
  constructor(private readonly eventBus: DomainEventBus) {}

  public onModuleInit(): void {
    this.eventBus.on(DOMAIN_EVENTS.PAYMENT_SUCCEEDED, (event) => {
      this.handlePaymentSucceeded(event);
    });
  }

  private handlePaymentSucceeded(_event: DomainEvent): void {
    // Cashback campaigns can hook in here without changing payment processing.
  }
}
