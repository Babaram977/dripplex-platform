import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommissionOwnerType, OrderPaymentMethod, WalletOwnerType } from '@prisma/client';

import { COMMISSION_REFERENCE_TYPES } from '../commercial/commercial.constants';
import { CommissionAccountService } from '../commercial/commission-account.service';
import { PlatformCommissionSettingsService } from '../commercial/platform-commission-settings.service';
import { ORDERS_REPOSITORY, type OrdersRepository } from '../orders/repositories/orders.repository';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

import { DELIVERY_AUDIT_ACTIONS } from './delivery.constants';

import type { AuditContext } from '../audit/audit.service';

/**
 * DPX-RIDER-006 — pays the rider for a completed delivery.
 *
 * Nothing did, before this. `deliver()` marked the job DELIVERED and emitted
 * DELIVERY_COMPLETED, which loyalty, notifications, analytics and the
 * MERCHANT's cash settlement all consumed — but no path ever credited the
 * rider. The delivery fee was collected and attributed to no one, and the
 * rider's Earnings screen showed ₦0 after a real delivery.
 *
 * Founder decisions, 2026-08-15:
 *
 *   • The rider earns the delivery fee minus the platform commission rate
 *     (DEFAULT_PLATFORM_COMMISSION_RATE, 10%, Ops-Console-adjustable — the
 *     same setting the merchant side reads, not a second hard-coded rate).
 *
 *   • PREPAID delivery: DrippleX holds the money, so the rider's earning is
 *     CREDITED to their wallet.
 *
 *   • CASH delivery: the rider physically holds the cash at the door, so
 *     nothing is credited — crediting would pay them twice. Instead they
 *     ACCRUE what they owe DrippleX (everything collected beyond their own
 *     earning) against the ₦10,000 rider credit limit that already exists.
 *
 * Idempotency: `settledAt` is set once, inside the same guard that reads it,
 * so a re-fired completion event cannot pay a rider twice. The commission
 * ledger's (account, referenceType, referenceId) uniqueness is a second line
 * of defence on the cash path.
 */
@Injectable()
export class RiderSettlementService {
  private readonly logger = new Logger(RiderSettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly commissionAccounts: CommissionAccountService,
    private readonly platformCommissionSettings: PlatformCommissionSettingsService,
    @Inject(ORDERS_REPOSITORY)
    private readonly ordersRepository: OrdersRepository,
  ) {}

  /**
   * Settle one delivery. Safe to call more than once — the second call is a
   * no-op. Returns true when this call performed the settlement.
   */
  public async settleDelivery(deliveryJobId: string, context: AuditContext = {}): Promise<boolean> {
    const job = await this.prisma.deliveryJob.findUnique({ where: { id: deliveryJobId } });
    if (!job) {
      this.logger.warn(`Delivery ${deliveryJobId} not found; nothing to settle.`);
      return false;
    }
    if (job.riderId === null) {
      // Cancelled or reassigned away before completion — nobody to pay.
      return false;
    }
    if (job.settledAt !== null) {
      return false;
    }

    const deliveryFee = Number(job.deliveryFee);
    if (!Number.isFinite(deliveryFee) || deliveryFee <= 0) {
      // A zero-fee delivery is not an error; there is simply nothing to split.
      await this.markSettled(job.id, 0, 0);
      return false;
    }

    const order = await this.ordersRepository.findById(job.orderId);
    const isCash = order?.paymentMethod === OrderPaymentMethod.CASH;

    // A cash delivery cannot be settled until the rider has said what they
    // actually took at the door.
    //
    // Both DELIVERY_COMPLETED and DELIVERY_CASH_CONFIRMED reach this service,
    // and the subscriber assumed either could settle because settlement is
    // idempotent. That holds for prepaid and fails for cash: confirmCash()
    // requires the job to be DELIVERED, so the completion event ALWAYS lands
    // first, always with cashCollectedAmount still null. The old code then
    // fell back to accruing the platform commission alone and claimed the
    // settlement, so the confirmation that followed hit the idempotency guard
    // and the real figure was never recorded.
    //
    // Observed in production on delivery b15f0efb: ₦7,412.50 collected, ₦150
    // accrued instead of ₦6,062.50 — the merchant's entire proceeds missing
    // from what the rider owed DrippleX. Every cash delivery did this.
    //
    // Returning early leaves settledAt null so the cash-confirmed event does
    // the real settlement.
    if (isCash && job.cashCollectedAmount === null) {
      return false;
    }

    const rate = await this.platformCommissionSettings.getEffectiveRate();
    // Round the platform's cut, then give the rider the remainder, so the two
    // halves always add back to exactly the fee — never a stray kobo either way.
    const platformCommission = Math.round(deliveryFee * rate * 100) / 100;
    const riderEarning = Math.round((deliveryFee - platformCommission) * 100) / 100;

    // Claim the settlement before moving money. If another worker already
    // claimed it, stop — this is the idempotency guard.
    const claimed = await this.prisma.deliveryJob.updateMany({
      where: { id: job.id, settledAt: null },
      data: { settledAt: new Date(), riderEarning, platformCommission },
    });
    if (claimed.count === 0) {
      return false;
    }

    if (isCash) {
      // The rider is holding the customer's cash. What they owe DrippleX is
      // everything they collected beyond their own earning — the merchant's
      // proceeds plus the platform's cut of the fee. The guard above
      // guarantees cashCollectedAmount is present by this point.
      const collected = Number(job.cashCollectedAmount);
      const owed = Math.max(0, collected - riderEarning);
      // accrue() rejects a non-positive amount. A rider who collected no more
      // than their own earning owes nothing — that is a valid settlement, not
      // an error, so record the split and stop.
      if (owed > 0) {
        await this.commissionAccounts.accrue({
          ownerType: CommissionOwnerType.RIDER,
          ownerId: job.riderId,
          amount: owed,
          referenceType: COMMISSION_REFERENCE_TYPES.DELIVERY_JOB,
          referenceId: job.id,
          description: `Cash delivery ${job.id} — collected on DrippleX's behalf`,
          context,
        });
      }
    } else if (riderEarning > 0) {
      // DrippleX holds the money, so the earning is paid straight out.
      await this.walletService.credit({
        ownerType: WalletOwnerType.RIDER,
        ownerId: job.riderId,
        amount: riderEarning,
        referenceType: COMMISSION_REFERENCE_TYPES.DELIVERY_JOB,
        referenceId: job.id,
        description: `Delivery ${job.id} earning`,
        context,
      });
    }

    this.logger.log(
      `Settled delivery ${job.id}: rider=${String(riderEarning)} platform=${String(
        platformCommission,
      )} mode=${isCash ? 'cash' : 'prepaid'}`,
    );
    return true;
  }

  private async markSettled(
    id: string,
    riderEarning: number,
    platformCommission: number,
  ): Promise<void> {
    await this.prisma.deliveryJob.updateMany({
      where: { id, settledAt: null },
      data: { settledAt: new Date(), riderEarning, platformCommission },
    });
  }
}

export { DELIVERY_AUDIT_ACTIONS };
