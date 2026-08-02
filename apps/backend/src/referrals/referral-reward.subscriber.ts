import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS, type DomainEvent } from '../events/domain-events';

import { ReferralsService } from './referrals.service';

@Injectable()
export class ReferralRewardSubscriber implements OnModuleInit {
  private readonly logger = new Logger(ReferralRewardSubscriber.name);

  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly referralsService: ReferralsService,
  ) {}

  public onModuleInit(): void {
    this.eventBus.on(DOMAIN_EVENTS.RIDE_COMPLETED, (event) => this.handle(event));
  }

  private async handle(event: DomainEvent): Promise<void> {
    const customerId = event.payload['customerId'];
    if (typeof customerId !== 'string' || customerId.length === 0) {
      return;
    }
    try {
      await this.referralsService.handleRefereeRideCompleted(customerId);
    } catch (error) {
      this.logger.error(
        `Referral reward check failed for customer ${customerId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }
}
