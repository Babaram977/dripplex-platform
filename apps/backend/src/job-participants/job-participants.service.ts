import { Injectable } from '@nestjs/common';
import { DeliveryStatus, MessageContextType, RideStatus } from '@prisma/client';

import {
  ForbiddenDomainException,
  NotFoundDomainException,
} from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

/** The two people a delivery or ride belongs to, resolved from the job itself. */
export interface JobParticipants {
  customerId: string;
  /** Null until a rider or driver is assigned. */
  courierId: string | null;
}

/**
 * A ride is over, one way or another. Call access ends here
 * (DPX-MOBILE-002 §6.2), and so does chat.
 *
 * `NO_DRIVERS_FOUND` is terminal too: the search gave up, and there is no
 * second party to reach.
 */
const TERMINAL_RIDE_STATUSES: readonly RideStatus[] = [
  RideStatus.COMPLETED,
  RideStatus.CANCELLED,
  RideStatus.NO_DRIVERS_FOUND,
];

/** The same, for a delivery job. `RETURNED` and `FAILED` are ends, not pauses. */
const TERMINAL_DELIVERY_STATUSES: readonly DeliveryStatus[] = [
  DeliveryStatus.DELIVERED,
  DeliveryStatus.FAILED,
  DeliveryStatus.RETURNED,
  DeliveryStatus.CANCELLED,
];

/**
 * DPX-CHAT-001 / DPX-MOBILE-002 — who the two parties of a job are, and whether
 * that job is still live.
 *
 * **Extracted from `MessagingService`, not copied.** It was private there, and
 * calling needs exactly the same question answered. Two divergent copies of a
 * permission check is how a customer eventually calls the wrong driver — so
 * this is the one implementation, and `MessagingService` now delegates to it.
 *
 * The properties that made it right for chat are what make it right for calls:
 *
 * - **Read fresh every time.** There is no membership list to keep in step with
 *   reassignment. Hand a ride to another driver and the previous one loses
 *   access on their next request, with no teardown step to forget.
 * - **Anchored to a job.** There is no way to address a stranger, because the
 *   only people this can ever return are the two on the job.
 * - **Cannot outlive its reason to exist.** A terminal job has no live parties.
 */
@Injectable()
export class JobParticipantsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The participants of a job, or a 404 when it does not exist.
   *
   * Deliberately does not consider whether the job is live: chat on a completed
   * ride is a separate question from placing a call on one, and collapsing them
   * here would change chat's behaviour while extracting it.
   */
  public async resolve(
    contextType: MessageContextType,
    contextId: string,
  ): Promise<JobParticipants> {
    if (contextType === MessageContextType.DELIVERY) {
      const job = await this.prisma.deliveryJob.findUnique({ where: { id: contextId } });
      if (!job) {
        throw new NotFoundDomainException('Delivery not found');
      }
      return { customerId: job.customerId, courierId: job.riderId };
    }

    const ride = await this.prisma.ride.findUnique({ where: { id: contextId } });
    if (!ride) {
      throw new NotFoundDomainException('Ride not found');
    }
    return { customerId: ride.customerId, courierId: ride.driverId };
  }

  /** The participants, or 403 when `userId` is not one of them. */
  public async requireParticipant(
    userId: string,
    contextType: MessageContextType,
    contextId: string,
  ): Promise<JobParticipants> {
    const participants = await this.resolve(contextType, contextId);
    if (userId !== participants.customerId && userId !== participants.courierId) {
      throw new ForbiddenDomainException('You are not part of this conversation');
    }
    return participants;
  }

  /**
   * Whether the job is still running.
   *
   * Checked fresh on every call attempt, which is why call access needs no
   * scheduled teardown (DPX-MOBILE-002 §6.2) — a call simply cannot be created
   * once the job is no longer live.
   *
   * **No grace period after completion.** A passenger who left a bag in the car
   * has a real reason to reach the driver afterwards, and a bounded window is
   * the likely answer — but the length of that window is an open founder
   * decision (§9), and inventing one here would quietly ship a policy nobody
   * chose. Until it is decided, completion ends call access.
   */
  public async isJobLive(contextType: MessageContextType, contextId: string): Promise<boolean> {
    if (contextType === MessageContextType.DELIVERY) {
      const job = await this.prisma.deliveryJob.findUnique({
        where: { id: contextId },
        select: { status: true },
      });
      return job !== null && !TERMINAL_DELIVERY_STATUSES.includes(job.status);
    }

    const ride = await this.prisma.ride.findUnique({
      where: { id: contextId },
      select: { status: true },
    });
    return ride !== null && !TERMINAL_RIDE_STATUSES.includes(ride.status);
  }
}
