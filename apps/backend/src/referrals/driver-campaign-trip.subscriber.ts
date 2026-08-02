import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS, type DomainEvent } from '../events/domain-events';

import { DriverCampaignService } from './driver-campaign.service';

@Injectable()
export class DriverCampaignTripSubscriber implements OnModuleInit {
  private readonly logger = new Logger(DriverCampaignTripSubscriber.name);

  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly driverCampaignService: DriverCampaignService,
  ) {}

  public onModuleInit(): void {
    this.eventBus.on(DOMAIN_EVENTS.RIDE_PAYMENT_SUCCEEDED, (event) => this.handle(event));
  }

  private async handle(event: DomainEvent): Promise<void> {
    const customerId = event.payload['customerId'];
    if (typeof customerId !== 'string' || customerId.length === 0) {
      return;
    }
    try {
      await this.driverCampaignService.handleRidePaymentSucceeded(customerId);
    } catch (error) {
      this.logger.error(
        `Driver campaign trip qualification check failed for customer ${customerId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }
}
