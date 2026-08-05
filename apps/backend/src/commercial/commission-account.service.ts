import { Injectable } from '@nestjs/common';
import { CommissionEntryType, Prisma } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ConflictDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import { CommercialCreditSettingsService } from './commercial-credit-settings.service';
import { COMMERCIAL_AUDIT_ACTIONS } from './commercial.constants';

import type { CommissionAccount, CommissionLedgerEntry, CommissionOwnerType } from '@prisma/client';

type CommercialTx = Prisma.TransactionClient;

interface MutationResult {
  account: CommissionAccount;
  applied: boolean;
}

/**
 * DPX-COMMERCIAL-001 Slice 1 — the liability-side primitives
 * (accrue/recordPayment/getOrCreateAccount) that later slices (Marketplace
 * "Pay to Merchant"/Cash on Delivery, Ride cash) will call from real
 * order/ride/delivery-job completion paths. Slice 1 wires no call site —
 * nothing existing changes behavior yet. See
 * docs/DPX-COMMERCIAL-001-REVENUE-SETTLEMENT-CREDIT-POLICY.md §3.1, §3.2.
 *
 * Mirrors WalletService.applyMutation()'s proven shape: an
 * exactly-once reference-based pre-check for ACCRUAL entries, an
 * optimistic-concurrency conditional update on the account's balance, and
 * a ledger entry recording the balance transition — same primitives, a
 * liability balance instead of an asset one.
 */
@Injectable()
export class CommissionAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly creditSettings: CommercialCreditSettingsService,
  ) {}

  /** Returns the account for (ownerType, ownerId), creating it — seeded
   * with the currently-effective credit limit — if none exists yet. Never
   * mutates outstandingBalance. */
  public async getOrCreateAccount(
    ownerType: CommissionOwnerType,
    ownerId: string,
  ): Promise<CommissionAccount> {
    const existing = await this.prisma.commissionAccount.findUnique({
      where: { ownerType_ownerId: { ownerType, ownerId } },
    });
    if (existing) {
      return existing;
    }

    const setting = await this.creditSettings.getEffective(ownerType);
    return await this.prisma.commissionAccount.create({
      data: {
        ownerType,
        ownerId,
        outstandingBalance: 0,
        creditLimit: setting.creditLimit,
      },
    });
  }

  /** Read-only listing of an account's ledger history, most recent first
   * — admin-facing visibility for Slice 1's manual payment recording. */
  public async listLedgerEntries(
    ownerType: CommissionOwnerType,
    ownerId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: CommissionLedgerEntry[]; total: number }> {
    const account = await this.getOrCreateAccount(ownerType, ownerId);
    const [items, total] = await Promise.all([
      this.prisma.commissionLedgerEntry.findMany({
        where: { accountId: account.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.commissionLedgerEntry.count({ where: { accountId: account.id } }),
    ]);
    return { items, total };
  }

  /** Accrues an owed commission amount (Marketplace mode B/C, Ride cash)
   * onto the owner's outstanding balance. referenceType/referenceId (e.g.
   * 'order'/orderId) make this exactly-once — a replayed call with the
   * same reference is a no-op, matching WalletService.applyMutation()'s
   * existing-ledger-entry short-circuit. */
  public async accrue(input: {
    ownerType: CommissionOwnerType;
    ownerId: string;
    amount: number | string | Prisma.Decimal;
    referenceType?: string;
    referenceId?: string;
    description?: string;
    context?: AuditContext;
  }): Promise<CommissionAccount> {
    const amount = this.toPositiveDecimal(input.amount);
    const result = await this.prisma.$transaction(async (tx) => {
      return await this.applyMutation(tx, {
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        amount,
        entryType: CommissionEntryType.ACCRUAL,
        direction: 'INCREASE',
        ...(input.referenceType !== undefined ? { referenceType: input.referenceType } : {}),
        ...(input.referenceId !== undefined ? { referenceId: input.referenceId } : {}),
        description: input.description ?? 'Commission accrued',
      });
    });

    if (result.applied) {
      await this.recomputeAndPersistBlockState(result.account, input.context);
    }

    return await this.currentAccount(result.account.id);
  }

  /** Reduces the owner's outstanding balance — either mechanism from
   * §0.2: automatic deduction from a mode-A settlement (referenceType/Id
   * set), or admin-manual recording of an external payment (no
   * reference). Unblocks the account the moment the balance drops back to
   * or below the credit limit. */
  public async recordPayment(input: {
    ownerType: CommissionOwnerType;
    ownerId: string;
    amount: number | string | Prisma.Decimal;
    referenceType?: string;
    referenceId?: string;
    description?: string;
    recordedBy: string;
    context?: AuditContext;
  }): Promise<CommissionAccount> {
    const amount = this.toPositiveDecimal(input.amount);
    const result = await this.prisma.$transaction(async (tx) => {
      return await this.applyMutation(tx, {
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        amount,
        entryType: CommissionEntryType.PAYMENT,
        direction: 'DECREASE',
        ...(input.referenceType !== undefined ? { referenceType: input.referenceType } : {}),
        ...(input.referenceId !== undefined ? { referenceId: input.referenceId } : {}),
        description: input.description ?? 'Commission payment recorded',
      });
    });

    if (result.applied) {
      await this.auditService.record(
        COMMERCIAL_AUDIT_ACTIONS.PAYMENT_RECORDED,
        { ...(input.context ?? {}), userId: input.recordedBy },
        {
          resource: 'commission_account',
          resourceId: result.account.id,
          metadata: {
            ownerType: input.ownerType,
            ownerId: input.ownerId,
            amount: amount.toNumber(),
            referenceType: input.referenceType ?? null,
            referenceId: input.referenceId ?? null,
            recordedBy: input.recordedBy,
          },
        },
      );
      await this.recomputeAndPersistBlockState(result.account, input.context);
    }

    return await this.currentAccount(result.account.id);
  }

  private async currentAccount(id: string): Promise<CommissionAccount> {
    return await this.prisma.commissionAccount.findUniqueOrThrow({ where: { id } });
  }

  private async applyMutation(
    tx: CommercialTx,
    input: {
      ownerType: CommissionOwnerType;
      ownerId: string;
      amount: Prisma.Decimal;
      entryType: CommissionEntryType;
      direction: 'INCREASE' | 'DECREASE';
      referenceType?: string;
      referenceId?: string;
      description?: string;
    },
  ): Promise<MutationResult> {
    let account = await tx.commissionAccount.findUnique({
      where: { ownerType_ownerId: { ownerType: input.ownerType, ownerId: input.ownerId } },
    });
    if (!account) {
      const setting = await this.creditSettings.getEffective(input.ownerType);
      account = await tx.commissionAccount.create({
        data: {
          ownerType: input.ownerType,
          ownerId: input.ownerId,
          outstandingBalance: 0,
          creditLimit: setting.creditLimit,
        },
      });
    }

    if (input.referenceType !== undefined && input.referenceId !== undefined) {
      const existingEntry = await tx.commissionLedgerEntry.findFirst({
        where: {
          accountId: account.id,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
        },
      });
      if (existingEntry) {
        return { account, applied: false };
      }
    }

    const currentBalance = new Prisma.Decimal(account.outstandingBalance);
    if (input.direction === 'DECREASE' && currentBalance.lessThan(input.amount)) {
      throw new ValidationDomainException('Payment amount exceeds outstanding commission balance');
    }

    const nextBalance =
      input.direction === 'INCREASE'
        ? currentBalance.plus(input.amount)
        : currentBalance.minus(input.amount);

    const updatedRows = await tx.commissionAccount.updateMany({
      where: { id: account.id, version: account.version },
      data: { outstandingBalance: nextBalance, version: { increment: 1 } },
    });
    if (updatedRows.count !== 1) {
      throw new ConflictDomainException('Commission account balance changed; retry operation');
    }

    await tx.commissionLedgerEntry.create({
      data: {
        accountId: account.id,
        type: input.entryType,
        amount: input.amount,
        balanceAfter: nextBalance,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        description: input.description ?? null,
      },
    });

    const updatedAccount = await tx.commissionAccount.findUniqueOrThrow({
      where: { id: account.id },
    });
    return { account: updatedAccount, applied: true };
  }

  /** Re-reads the currently-effective credit limit, re-syncs it onto the
   * account (prospective-only, per §3.2), and recomputes `blocked` from
   * `outstandingBalance > creditLimit`. Called after every accrue()/
   * recordPayment() — never on a bare read. */
  private async recomputeAndPersistBlockState(
    account: CommissionAccount,
    context?: AuditContext,
  ): Promise<void> {
    const setting = await this.creditSettings.getEffective(account.ownerType);
    const balance = new Prisma.Decimal(account.outstandingBalance);
    const creditLimit = new Prisma.Decimal(setting.creditLimit);
    const shouldBeBlocked = balance.greaterThan(creditLimit);

    if (shouldBeBlocked === account.blocked && creditLimit.equals(account.creditLimit)) {
      return;
    }

    const updated = await this.prisma.commissionAccount.update({
      where: { id: account.id },
      data: {
        creditLimit,
        blocked: shouldBeBlocked,
        blockedAt: shouldBeBlocked ? (account.blocked ? account.blockedAt : new Date()) : null,
      },
    });

    if (shouldBeBlocked !== account.blocked) {
      await this.auditService.record(
        shouldBeBlocked ? COMMERCIAL_AUDIT_ACTIONS.BLOCKED : COMMERCIAL_AUDIT_ACTIONS.UNBLOCKED,
        { ...(context ?? {}), userId: account.ownerId },
        {
          resource: 'commission_account',
          resourceId: updated.id,
          metadata: {
            ownerType: account.ownerType,
            ownerId: account.ownerId,
            outstandingBalance: balance.toNumber(),
            creditLimit: creditLimit.toNumber(),
          },
        },
      );
    }
  }

  private toPositiveDecimal(value: number | string | Prisma.Decimal): Prisma.Decimal {
    const decimal = new Prisma.Decimal(value);
    if (decimal.lessThanOrEqualTo(0)) {
      throw new ValidationDomainException('Amount must be greater than zero');
    }
    return decimal;
  }
}
