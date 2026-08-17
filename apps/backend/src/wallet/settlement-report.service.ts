import { Injectable } from '@nestjs/common';
import { CommissionOwnerType, WalletOwnerType, WithdrawalRequestStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

/** One line on the Monday payout run: a person, where to send it, how much. */
export interface SettlementLineDto {
  withdrawalId: string;
  userId: string;
  partnerType: 'RIDER' | 'DRIVER';
  name: string;
  phone: string | null;
  bankName: string;
  accountName: string;
  accountNumber: string;
  amount: number;
  currency: string;
  requestedAt: string;
  /**
   * What this partner still owes DrippleX on cash jobs they collected — from
   * their CommissionAccount, which is a separate ledger from their wallet.
   *
   * Commission is now netted off at the moment the payout is requested
   * (founder decision, 2026-08-17), so `amount` is already the figure to
   * transfer. A non-zero number here means their earnings were not enough to
   * clear the debt — not that Operations should subtract it again.
   */
  outstandingCommission: number;
}

export interface SettlementReportDto {
  /** Monday 00:00 Lagos of the run this report is for, ISO. */
  weekStart: string;
  /** The following Monday 00:00 Lagos, ISO — exclusive. */
  weekEnd: string;
  generatedAt: string;
  lines: SettlementLineDto[];
  totals: {
    riderCount: number;
    driverCount: number;
    riderAmount: number;
    driverAmount: number;
    totalAmount: number;
  };
}

/** Lagos is UTC+1 year-round — no daylight saving to track. */
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

/**
 * The Monday 00:00 Lagos at or before `at`.
 *
 * Anchoring on Lagos rather than UTC matters at the edges: a request raised at
 * 00:30 Monday Lagos is 23:30 Sunday UTC, and a UTC-anchored week would push it
 * into the previous run — a rider waiting an extra seven days for money they
 * asked for on the right day.
 */
export function lagosWeekStart(at: Date): Date {
  const lagos = new Date(at.getTime() + LAGOS_OFFSET_MS);
  const dayOfWeek = lagos.getUTCDay(); // 0 = Sunday
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const midnight = Date.UTC(
    lagos.getUTCFullYear(),
    lagos.getUTCMonth(),
    lagos.getUTCDate() - daysSinceMonday,
  );
  return new Date(midnight - LAGOS_OFFSET_MS);
}

/**
 * DPX-PAYOUT-001 — the weekly settlement report.
 *
 * Founder decision (2026-08-16): "Ops do transfer manually, report will be
 * generated with rider/drivers details and amount to be settled."
 *
 * So this does not move money and does not decide anything. It answers one
 * question for the person doing the Monday run: who is waiting to be paid,
 * how much, and into which account. The money left their wallet when they
 * asked for it — `WithdrawalService.create()` debits at request time — so a
 * line here is a debt DrippleX has already recognised, not a proposal.
 *
 * Paying is still `POST /admin/wallet/withdrawals/:id/complete`, one request
 * at a time, exactly as it already worked. Nothing on this report marks
 * anything paid, so running it twice is harmless.
 */
@Injectable()
export class SettlementReportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * @param at any instant inside the week to report on — defaults to now, so
   *   Operations opening this on Monday morning gets that Monday's run.
   * @param includeOlder pending requests from before this week are included by
   *   default: they are unpaid debts and dropping them off the report is how
   *   somebody goes unpaid indefinitely.
   */
  public async weekly(at: Date = new Date(), includeOlder = true): Promise<SettlementReportDto> {
    const weekStart = lagosWeekStart(at);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const pending = await this.prisma.withdrawalRequest.findMany({
      where: {
        status: WithdrawalRequestStatus.PENDING,
        createdAt: includeOlder ? { lt: weekEnd } : { gte: weekStart, lt: weekEnd },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, phone: true } },
        bankAccount: { select: { bankName: true, accountName: true, accountNumber: true } },
      },
    });

    if (pending.length === 0) {
      return this.empty(weekStart, weekEnd);
    }

    // Only rider and driver wallets are partner payouts. A customer withdrawing
    // their own topped-up balance is a different queue and does not belong on a
    // partner settlement run.
    const walletIds = [...new Set(pending.map((row) => row.walletId))];
    const wallets = await this.prisma.wallet.findMany({
      where: { id: { in: walletIds } },
      select: { id: true, ownerType: true },
    });
    const ownerTypeByWallet = new Map(wallets.map((w) => [w.id, w.ownerType] as const));

    const partnerRows = pending.filter((row) => {
      const ownerType = ownerTypeByWallet.get(row.walletId);
      return ownerType === WalletOwnerType.RIDER || ownerType === WalletOwnerType.DRIVER;
    });

    if (partnerRows.length === 0) {
      return this.empty(weekStart, weekEnd);
    }

    const commissionByOwner = await this.outstandingCommission(
      partnerRows.map((row) => row.userId),
    );

    const lines: SettlementLineDto[] = partnerRows.map((row) => {
      const partnerType =
        ownerTypeByWallet.get(row.walletId) === WalletOwnerType.RIDER ? 'RIDER' : 'DRIVER';
      return {
        withdrawalId: row.id,
        userId: row.userId,
        partnerType,
        name: `${row.user.firstName} ${row.user.lastName}`.trim(),
        phone: row.user.phone,
        bankName: row.bankAccount.bankName,
        accountName: row.bankAccount.accountName,
        accountNumber: row.bankAccount.accountNumber,
        amount: Number(row.amount),
        currency: row.currency,
        requestedAt: row.createdAt.toISOString(),
        outstandingCommission: commissionByOwner.get(row.userId) ?? 0,
      };
    });

    const riderLines = lines.filter((line) => line.partnerType === 'RIDER');
    const driverLines = lines.filter((line) => line.partnerType === 'DRIVER');
    const sum = (rows: SettlementLineDto[]): number =>
      rows.reduce((total, row) => total + row.amount, 0);

    return {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      generatedAt: new Date().toISOString(),
      lines,
      totals: {
        riderCount: new Set(riderLines.map((line) => line.userId)).size,
        driverCount: new Set(driverLines.map((line) => line.userId)).size,
        riderAmount: sum(riderLines),
        driverAmount: sum(driverLines),
        totalAmount: sum(lines),
      },
    };
  }

  private async outstandingCommission(userIds: string[]): Promise<Map<string, number>> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) {
      return new Map();
    }
    const accounts = await this.prisma.commissionAccount.findMany({
      where: {
        ownerId: { in: unique },
        ownerType: { in: [CommissionOwnerType.RIDER, CommissionOwnerType.DRIVER] },
      },
      select: { ownerId: true, outstandingBalance: true },
    });
    return new Map(
      accounts.map((account) => [account.ownerId, Number(account.outstandingBalance)] as const),
    );
  }

  private empty(weekStart: Date, weekEnd: Date): SettlementReportDto {
    return {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      generatedAt: new Date().toISOString(),
      lines: [],
      totals: {
        riderCount: 0,
        driverCount: 0,
        riderAmount: 0,
        driverAmount: 0,
        totalAmount: 0,
      },
    };
  }
}
