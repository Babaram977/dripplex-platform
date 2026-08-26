import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MessageContextType } from '@prisma/client';

import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS, type DomainEvent } from '../events/domain-events';

import { CallsService } from './calls.service';

/**
 * DPX-MOBILE-002 §6.3 — hang up when the job underneath a call is cancelled.
 *
 * Call access is checked when a call is *created* and never re-checked
 * afterwards. That is deliberate and correct for placing a call, but it leaves
 * one gap: Operations can cancel a ride mid-trip, and the two people on it keep
 * talking on a job that no longer exists, in a room nothing will close.
 *
 * Cancellation only, not completion. A passenger who has left a bag in the car
 * has a real reason to still be talking as the ride completes, and how long
 * that should remain possible is the open grace-period question (§9). Cutting
 * the call off at completion would answer that question by accident, which is
 * exactly what a design document exists to prevent.
 *
 * Subscribed rather than called from the rides module: the Rides module does
 * not import calling, every other cross-module reaction here goes through the
 * bus, and a cancellation must not fail because a call could not be ended.
 */
@Injectable()
export class CancelledJobCallSubscriber implements OnModuleInit {
  private readonly logger = new Logger(CancelledJobCallSubscriber.name);

  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly callsService: CallsService,
  ) {}

  public onModuleInit(): void {
    this.eventBus.on(DOMAIN_EVENTS.RIDE_CANCELLED, (event) => this.handle(event));
  }

  public async handle(event: DomainEvent): Promise<void> {
    const rideId = typeof event.payload['rideId'] === 'string' ? event.payload['rideId'] : '';
    if (rideId === '') {
      return;
    }

    try {
      const ended = await this.callsService.endCallsForCancelledJob(
        MessageContextType.RIDE,
        rideId,
      );
      if (ended > 0) {
        this.logger.log(`Ended ${String(ended)} live call(s) on cancelled ride ${rideId}`);
      }
    } catch (error) {
      // A cancellation that fails because a call could not be hung up would be
      // a far worse bug than a call that outlives its ride by a few seconds.
      this.logger.warn(
        `Failed to end calls on cancelled ride ${rideId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }
}
