import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';
import { PrismaService } from '../prisma/prisma.service';

import { FleetCommissionService } from './fleet-commission.service';
import { FleetsService } from './fleets.service';

/**
 * DPX-FLEET — counts a fleet's completed deliveries towards its month.
 *
 * A subscriber rather than a call inside `DeliveryService`, for the reason the
 * rest of the platform already uses one: the delivery module should not have
 * to know that fleets exist, and a fleet counting failure must never be able
 * to fail the delivery that a customer has already received.
 *
 * Founder decision, 2026-08-30 — commission is "8% of the delivery fee the
 * system charge", so the delivery fee is what accumulates here, and the count
 * of deliveries is what selects the band at month end.
 *
 * GAP, recorded rather than filled: rides are not counted. The founder
 * specified the commission base for deliveries only, and a ride already
 * carries its own platform commission against the driver
 * (`Ride.platformCommissionRate`, 10%). Counting rides here as well would
 * charge twice for the same trip, and choosing a different base for cars
 * would be inventing a figure nobody agreed. So a fleet of cars accumulates
 * no fleet commission today — flagged for founder confirmation before the
 * six-car client is invoiced.
 */
@Injectable()
export class FleetDeliverySubscriber implements OnModuleInit {
  private readonly logger = new Logger(FleetDeliverySubscriber.name);

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
  }

  private async handleDeliveryCompleted(payload: unknown): Promise<void> {
    const { deliveryJobId, riderId } = (payload ?? {}) as {
      deliveryJobId?: string;
      riderId?: string;
    };
    if (deliveryJobId === undefined || riderId === undefined) return;

    try {
      const membership = await this.fleets.fleetForUser(riderId);
      // Most riders are not on a fleet. That is the common path and is not
      // worth a log line.
      if (membership === null) return;

      const job = await this.prisma.deliveryJob.findUnique({
        where: { id: deliveryJobId },
        select: { deliveryFee: true, deliveredAt: true },
      });
      if (!job) return;

      await this.commission.recordDelivery({
        fleetId: membership.fleet.id,
        deliveryFee: job.deliveryFee,
        // The month a delivery belongs to is when it was delivered, not when
        // this handler happened to run.
        ...(job.deliveredAt !== null ? { at: job.deliveredAt } : {}),
      });
    } catch (error: unknown) {
      // Never rethrow. The customer has their order; a miscounted commission
      // is a reconciliation job, not a reason to fail a completed delivery.
      this.logger.error(
        `Could not count delivery ${deliveryJobId} towards its fleet: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
