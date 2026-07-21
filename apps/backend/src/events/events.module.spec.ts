import { Test } from '@nestjs/testing';

import { DomainEventBus } from './domain-event-bus';
import { DOMAIN_EVENTS, EventsModule } from './events.module';

describe('EventsModule', () => {
  it('provides the domain event bus', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [EventsModule],
    }).compile();

    expect(moduleRef.get(DomainEventBus)).toBeInstanceOf(DomainEventBus);
  });

  it('exports the shared domain event names', () => {
    expect(DOMAIN_EVENTS.ORDER_CREATED).toBe('OrderCreated');
    expect(DOMAIN_EVENTS.PAYMENT_SUCCEEDED).toBe('PaymentSucceeded');
  });
});
