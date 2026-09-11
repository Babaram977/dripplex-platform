import { Injectable } from '@nestjs/common';
import {
  CommissionEntryType,
  CommissionOwnerType,
  FleetSettlementRequestStatus,
  WalletDirection,
  WalletOwnerType,
  WithdrawalRequestStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { CommissionAccountService } from './commission-account.service';

import type { PartnerFinancialPositionDto } from '@dripplex/types';
import type { Prisma } from '@prisma/client';

/**
 * "What does DrippleX have with this merchant / driver / rider / fleet?"
 *
 * The answer lived in two unconnected places: a Wallet holding money *for* the
 * partner, and a CommissionAccount recording what the partner owes *us*. Ops
 * could read either one, but nothing composed them, so the position could only
 * be worked out by hand — and the commission side was not reachable from the
 * console at all until the commissions desk shipped.
 *
 * Read-only, and deliberately a composition rather than new accounting: every
 * figure here is summed from ledgers that already exist. Nothing is stored.
 */
@Injectable()
export class PartnerPositionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: CommissionAccountService,
  ) {}

  public async getPosition(
    ownerType: CommissionOwnerType,
    ownerId: string,
  ): Promise<PartnerFinancialPositionDto> {
    // DPX-FLEET — a fleet is a company, not a person, and every assumption
    // below about "a partner" is a personal one: its `ownerId` is a fleet id
    // rather than a user id, it holds no wallet, and it asks for money through
    // its own settlement queue instead of a withdrawal request.
    //
    // It used to fall through the ternary below into the RIDER branch, so the
    // console looked up a User by a fleet id and found nobody: a fleet's
    // position rendered nameless, with no wallet and no pending payouts, while
    // its commission balance was real. It is answered on its own terms instead.
    if (ownerType === CommissionOwnerType.FLEET) {
      return await this.getFleetPosition(ownerId);
    }

    // CommissionOwnerType and WalletOwnerType are separate enums that happen to
    // share MERCHANT/DRIVER/RIDER. Mapped explicitly so a later divergence is a
    // compile error rather than a silently empty wallet. FLEET has already
    // returned above — it has no wallet to map to.
    const walletOwnerType: WalletOwnerType =
      ownerType === CommissionOwnerType.MERCHANT
        ? WalletOwnerType.MERCHANT
        : ownerType === CommissionOwnerType.DRIVER
          ? WalletOwnerType.DRIVER
          : WalletOwnerType.RIDER;

    const account = await this.accounts.getOrCreateAccount(ownerType, ownerId);

    const [user, wallet, commissionSums, pendingWithdrawals] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: ownerId },
        select: { firstName: true, lastName: true, email: true, phone: true },
      }),
      this.prisma.wallet.findFirst({
        where: { ownerType: walletOwnerType, ownerId, deletedAt: null },
        select: { id: true, availableBalance: true, pendingBalance: true },
      }),
      this.prisma.commissionLedgerEntry.groupBy({
        by: ['type'],
        where: { accountId: account.id },
        _sum: { amount: true },
      }),
      this.prisma.withdrawalRequest.aggregate({
        where: { userId: ownerId, status: WithdrawalRequestStatus.PENDING },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const walletSums = wallet
      ? await this.prisma.walletLedgerEntry.groupBy({
          by: ['direction'],
          where: { walletId: wallet.id },
          _sum: { amount: true },
        })
      : [];

    const money = (value: Prisma.Decimal | null | undefined): number => (value ? Number(value) : 0);
    const round = (value: number): number => Math.round(value * 100) / 100;
    const commissionSum = (type: CommissionEntryType): number =>
      money(commissionSums.find((row) => row.type === type)?._sum.amount);
    const walletSum = (direction: WalletDirection): number =>
      money(walletSums.find((row) => row.direction === direction)?._sum.amount);

    const walletAvailable = money(wallet?.availableBalance);
    const commissionOutstanding = money(account.outstandingBalance);

    return {
      ownerType,
      ownerId,
      name: user ? `${user.firstName} ${user.lastName}`.trim() : null,
      email: user?.email ?? null,
      phone: user?.phone ?? null,

      walletAvailable: round(walletAvailable),
      walletPending: round(money(wallet?.pendingBalance)),

      commissionOutstanding: round(commissionOutstanding),
      commissionCreditLimit: round(money(account.creditLimit)),
      negotiatedCreditLimit:
        account.negotiatedCreditLimit === null ? null : round(money(account.negotiatedCreditLimit)),
      negotiatedAt: account.negotiatedAt?.toISOString() ?? null,
      negotiationNote: account.negotiationNote,
      blocked: account.blocked,
      blockedAt: account.blockedAt?.toISOString() ?? null,

      netPosition: round(walletAvailable - commissionOutstanding),

      lifetimeCommissionAccrued: round(commissionSum(CommissionEntryType.ACCRUAL)),
      lifetimeCommissionPaid: round(commissionSum(CommissionEntryType.PAYMENT)),
      lifetimeWalletCredited: round(walletSum(WalletDirection.CREDIT)),
      lifetimeWalletDebited: round(walletSum(WalletDirection.DEBIT)),

      pendingWithdrawalAmount: round(money(pendingWithdrawals._sum.amount)),
      pendingWithdrawalCount: pendingWithdrawals._count,
    };
  }

  /**
   * The same question, asked of a company instead of a person.
   *
   * Three things are genuinely different about a fleet, and each is answered
   * from the fleet's own records rather than left empty:
   *
   * - **It has a name, not a person's name.** The fleet's own name and DX
   *   number, with the owner's contact details beside them, because an operator
   *   chasing a bill needs somebody to call.
   * - **It holds no wallet.** What DrippleX owes a fleet arrives as approved
   *   settlement receivables, so the remaining balance on those is this
   *   entity's equivalent of a wallet balance. Reporting ₦0 because there is no
   *   Wallet row would say DrippleX owes it nothing, which is a different and
   *   usually false claim.
   * - **It asks for money through its own queue.** A pending payout is a
   *   `FleetSettlementRequest`, not a `WithdrawalRequest` filed by a user.
   */
  private async getFleetPosition(fleetId: string): Promise<PartnerFinancialPositionDto> {
    const account = await this.accounts.getOrCreateAccount(CommissionOwnerType.FLEET, fleetId);

    const [fleet, receivables, commissionSums, pendingRequests, settledTransfers] =
      await Promise.all([
        this.prisma.fleet.findUnique({
          where: { id: fleetId },
          select: {
            name: true,
            fleetNumber: true,
            contactPhone: true,
            owner: { select: { email: true, phone: true } },
          },
        }),
        this.prisma.fleetSettlementReceivable.aggregate({
          where: { fleetId },
          _sum: { amount: true, remainingAmount: true },
        }),
        this.prisma.commissionLedgerEntry.groupBy({
          by: ['type'],
          where: { accountId: account.id },
          _sum: { amount: true },
        }),
        this.prisma.fleetSettlementRequest.aggregate({
          where: { fleetId, status: FleetSettlementRequestStatus.PENDING },
          _sum: { amount: true },
          _count: true,
        }),
        this.prisma.fleetSettlementRequest.aggregate({
          where: { fleetId, status: FleetSettlementRequestStatus.PAID },
          _sum: { amount: true },
        }),
      ]);

    const money = (value: Prisma.Decimal | null | undefined): number => (value ? Number(value) : 0);
    const round = (value: number): number => Math.round(value * 100) / 100;
    const commissionSum = (type: CommissionEntryType): number =>
      money(commissionSums.find((row) => row.type === type)?._sum.amount);

    // Approved and not yet paid out: the fleet's claim on DrippleX, which is
    // what a wallet balance means for everybody else.
    const receivableRemaining = money(receivables._sum.remainingAmount);
    const commissionOutstanding = money(account.outstandingBalance);

    return {
      ownerType: CommissionOwnerType.FLEET,
      ownerId: fleetId,
      // The DX number is how Operations and the fleet actually refer to it out
      // loud, so it belongs in the name rather than only in a detail view.
      name: fleet === null ? null : `${fleet.name} (${fleet.fleetNumber})`,
      email: fleet?.owner.email ?? null,
      phone: fleet?.contactPhone ?? fleet?.owner.phone ?? null,

      walletAvailable: round(receivableRemaining),
      // A receivable is approved or it is not; there is no pending tier to it.
      walletPending: 0,

      commissionOutstanding: round(commissionOutstanding),
      commissionCreditLimit: round(money(account.creditLimit)),
      negotiatedCreditLimit:
        account.negotiatedCreditLimit === null ? null : round(money(account.negotiatedCreditLimit)),
      negotiatedAt: account.negotiatedAt?.toISOString() ?? null,
      negotiationNote: account.negotiationNote,
      blocked: account.blocked,
      blockedAt: account.blockedAt?.toISOString() ?? null,

      netPosition: round(receivableRemaining - commissionOutstanding),

      lifetimeCommissionAccrued: round(commissionSum(CommissionEntryType.ACCRUAL)),
      lifetimeCommissionPaid: round(commissionSum(CommissionEntryType.PAYMENT)),
      // Everything ever approved to the fleet, and everything actually sent —
      // the receivable and transfer analogues of a wallet's two directions.
      lifetimeWalletCredited: round(money(receivables._sum.amount)),
      lifetimeWalletDebited: round(money(settledTransfers._sum.amount)),

      pendingWithdrawalAmount: round(money(pendingRequests._sum.amount)),
      pendingWithdrawalCount: pendingRequests._count,
    };
  }
}
