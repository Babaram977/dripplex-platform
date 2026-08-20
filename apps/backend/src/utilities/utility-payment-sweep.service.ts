import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { UtilityPurchaseStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import {
  UTILITY_PAYMENT_SWEEP_BATCH,
  UTILITY_PAYMENT_SWEEP_GRACE_MS,
  UTILITY_PAYMENT_SWEEP_INTERVAL_MS,
  UTILITY_PAYMENT_SWEEP_MAX_AGE_MS,
} from './utilities.constants';
import { UtilitiesService } from './utilities.service';

/**
 * Finds card purchases the customer paid for and nobody ever completed.
 *
 * The card path deliberately does not touch Peyflex until the money is
 * confirmed — an abandoned checkout must cost nothing. That ordering is
 * right. What was missing is a trigger that does not depend on an event
 * arriving:
 *
 *   1. the customer returning to the app  → they may close the tab
 *   2. the gateway webhook                → it may never land
 *
 * Both are event-driven, and the code that added (2) recorded the assumption
 * that "the webhook always arrives". When neither fires the row sits on
 * AWAITING_PAYMENT indefinitely: DrippleX is holding the customer's money in
 * its gateway account, Peyflex was never called, and no airtime exists. A
 * ₦1,000 purchase on 2026-08-19 sat in exactly that state.
 *
 * This sweep polls instead. It re-asks the gateway about each stale purchase
 * and, for the ones the gateway confirms were paid, runs the same idempotent
 * confirmation the other two triggers use — so a rescued purchase is
 * delivered, not refunded. Getting the customer what they paid for beats
 * giving the money back.
 *
 * It deliberately does **not** expire or cancel anything. A purchase the
 * gateway says is unpaid is left exactly as it is: whether an abandoned
 * checkout should be cleaned up is a policy decision nobody has made, and
 * inventing one here would be the wrong place for it.
 *
 * Plain `setInterval`, mirroring RideOfferSweepService and
 * ReservationCleanupService — this codebase has no @nestjs/schedule
 * dependency.
 */
@Injectable()
export class UtilityPaymentSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UtilityPaymentSweepService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly utilitiesService: UtilitiesService,
  ) {}

  public onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.runSweep();
    }, UTILITY_PAYMENT_SWEEP_INTERVAL_MS);
    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  public onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Returns how many purchases were actually rescued — paid, and now
   *  delivered. Unpaid rows are not counted, because nothing happened to
   *  them. */
  public async runSweep(): Promise<number> {
    if (this.running) {
      return 0;
    }
    this.running = true;
    try {
      const now = Date.now();
      const stale = await this.prisma.utilityPurchase.findMany({
        where: {
          status: UtilityPurchaseStatus.AWAITING_PAYMENT,
          // A row with no gateway reference has nothing to ask about.
          paymentReference: { not: null },
          createdAt: {
            lt: new Date(now - UTILITY_PAYMENT_SWEEP_GRACE_MS),
            gte: new Date(now - UTILITY_PAYMENT_SWEEP_MAX_AGE_MS),
          },
        },
        orderBy: { createdAt: 'asc' },
        take: UTILITY_PAYMENT_SWEEP_BATCH,
      });

      let rescued = 0;
      for (const purchase of stale) {
        try {
          const result = await this.utilitiesService.confirmCardPurchase(
            purchase.customerId,
            purchase.id,
            {},
          );
          if (result.status !== UtilityPurchaseStatus.AWAITING_PAYMENT) {
            rescued += 1;
            this.logger.warn(
              `Utility purchase ${purchase.id} was paid but never completed — ` +
                `settled by sweep as ${result.status}. ` +
                `Created ${purchase.createdAt.toISOString()}, reference ${String(
                  purchase.paymentReference,
                )}.`,
            );
          }
        } catch {
          // The expected case, not an error: the gateway says this one was
          // never paid, so `confirmCardPurchase` refuses. That is an
          // abandoned checkout, it cost nobody anything, and it is left
          // alone. Logging each one every five minutes would bury the rescues
          // this sweep exists to surface.
          continue;
        }
      }

      if (rescued > 0) {
        this.logger.warn(
          `Payment sweep recovered ${String(rescued)} paid-but-undelivered utility purchase(s). ` +
            `Repeated non-zero sweeps mean the gateway webhook is not reaching this service.`,
        );
      }
      return rescued;
    } finally {
      this.running = false;
    }
  }
}
