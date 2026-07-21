import { Global, Module } from '@nestjs/common';

import { DomainEventBus } from './domain-event-bus';
export { DOMAIN_EVENTS } from './domain-events';

@Global()
@Module({
  providers: [DomainEventBus],
  exports: [DomainEventBus],
})
export class EventsModule {}
