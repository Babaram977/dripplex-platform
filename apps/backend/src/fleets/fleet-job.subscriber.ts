import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';
import { PrismaService } from '../prisma/prisma.service';

import { FleetCommissionService } from './fleet-commission.service';
import { FleetsService } from './fleets.service';

/**
 * DPX-FLEET — counts a fleet's completed work towards its month.
 *
 * A subscriber rather than a call inside the delivery and ride services, for
 * the reason the rest of the platform already uses one: those modules should
 * not have to know that fleets exist, and a counting failure must never fail
 * a job the customer has already received.
 *
 * Founder decisions, 2026-08-30. Commission is charged on "the delivery fee
 * the system charge" for a delivery, and — asked and answered separately —
 * "rides should count too, use the trip fare". So both land here, each with
 * its own base, and both count towards the volume that picks the band.
 *
 * WORTH KNOWING, and flagged rather than decided here: a ride already carries
 * its own platform commission against the driver
 * (`Ride.platformCommissionRate`, 10% by default). A fleet driver's trip
 * therefore now attracts that 10% from the driver AND the fleet's band rate
 * from the fleet. That is what was asked for, and it may well be intended —
 * but it means DrippleX's total take on a fleet trip is the sum of the two,
 * which is worth setting the band rates with open eyes.
 */
@Injectable()
export class FleetJobSubscriber implements OnModuleInit {
  private readonly logger = new Logger(FleetJobSubscriber.name);

  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly prisma: PrismaService,
    private readonly fleets: FleetsService,
    private readonly commission: FleetCommissionService,
  ) {}

  public onModuleInit(): void {
    this.eventBus.on(DOMAIN_EVENTS.DELIVERY_COMPLETED, async (payload: unknown) => {
      await this.handleDeliveryCompleted(payload);
    });
    this.eventBus.on(DOMAIN_EVENTS.RIDE_COMPLETED, async (payload: unknown) => {
      await this.handleRideCompleted(payload);
    });
  }

  private async handleDeliveryCompleted(payload: unknown): Promise<void> {
    const { deliveryJobId, riderId } = (payload ?? {}) as {
      deliveryJobId?: string;
      riderId?: string;
    };
    if (deliveryJobId === undefined || riderId === undefined) return;

    await this.count('delivery', deliveryJobId, async () => {
      const job = await this.prisma.deliveryJob.findUnique({
        where: { id: deliveryJobId },
        select: { deliveryFee: true, deliveredAt: true },
      });
      if (!job) return null;
      return { userId: riderId, amount: job.deliveryFee, at: job.deliveredAt };
    });
  }

  /**
   * The RideCompleted payload carries the fare but not the driver, so the ride
   * is read back — which is what should happen anyway: the row is the record,
   * and reading it means the fare charged and the driver credited always agree
   * with what was actually settled.
   */
  private async handleRideCompleted(payload: unknown): Promise<void> {
    const { rideId } = (payload ?? {}) as { rideId?: string };
    if (rideId === undefined) return;

    await this.count('ride', rideId, async () => {
      const ride = await this.prisma.ride.findUnique({
        where: { id: rideId },
        select: { driverId: true, totalFare: true, completedAt: true },
      });
      // An unassigned ride cannot belong to a fleet, and a missing row has
      // nothing to count.
      if (ride === null) return null;
      const { driverId } = ride;
      if (driverId === null) return null;
      return { userId: driverId, amount: ride.totalFare, at: ride.completedAt };
    });
  }

  private async count(
    kind: string,
    jobId: string,
    resolve: () => Promise<{
      userId: string;
      amount: unknown;
      at: Date | null;
    } | null>,
  ): Promise<void> {
    try {
      const job = await resolve();
      if (job === null) return;

      const membership = await this.fleets.fleetForUser(job.userId);
      // Most riders and drivers are not on a fleet. That is the common path
      // and is not worth a log line.
      if (membership === null) return;

      await this.commission.recordJob({
        fleetId: membership.fleet.id,
        amount: job.amount as number,
        // The month a job belongs to is when it finished, not when this
        // handler happened to run.
        ...(job.at !== null ? { at: job.at } : {}),
      });
    } catch (error: unknown) {
      // Never rethrow. The customer has their trip or their order; a
      // miscounted commission is a reconciliation job, not a reason to fail
      // something that already happened.
      this.logger.error(
        `Could not count ${kind} ${jobId} towards its fleet: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
