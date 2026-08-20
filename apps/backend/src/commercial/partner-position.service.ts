import { Injectable } from '@nestjs/common';
import {
  CommissionEntryType,
  CommissionOwnerType,
  WalletDirection,
  WalletOwnerType,
  WithdrawalRequestStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { CommissionAccountService } from './commission-account.service';

import type { PartnerFinancialPositionDto } from '@dripplex/types';
import type { Prisma } from '@prisma/client';

/**
 * "What does DrippleX have with this merchant / driver / rider?"
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
    // CommissionOwnerType and WalletOwnerType are separate enums that happen to
    // share MERCHANT/DRIVER/RIDER. Mapped explicitly so a later divergence is a
    // compile error rather than a silently empty wallet.
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
}
