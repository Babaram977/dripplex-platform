import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { CommissionOwnerType, WalletOwnerType, WithdrawalRequestStatus } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import { CommissionAccountService } from '../commercial/commission-account.service';
import {
  ForbiddenDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';
import { PrismaService } from '../prisma/prisma.service';

import { BankAccountsService } from './bank-accounts.service';
import { WalletPinService } from './wallet-pin.service';
import {
  WALLET_AUDIT_ACTIONS,
  WALLET_WITHDRAWAL_MAX_AMOUNT,
  WALLET_WITHDRAWAL_MIN_AMOUNT,
  WALLET_COMMISSION_SETTLEMENT_REFERENCE_TYPE,
  WALLET_WITHDRAWAL_REFERENCE_TYPE,
  WALLET_WITHDRAWAL_REVERSAL_REFERENCE_TYPE,
} from './wallet.constants';
import { WalletService } from './wallet.service';

import type { PaginatedResult } from '@dripplex/types';
import type { WithdrawalRequest } from '@prisma/client';

/**
 * What came of a payout request: how much went to clearing commission owed,
 * and the bank transfer that remains — `null` when the whole request was
 * absorbed by the debt and there is nothing left to send.
 */
export interface PayoutResultDto {
  commissionSettled: number;
  payout: WithdrawalRequestDto | null;
}

export interface WithdrawalRequestDto {
  id: string;
  amount: number;
  currency: string;
  status: WithdrawalRequestStatus;
  bankAccountId: string;
  failureReason: string | null;
  adminNote: string | null;
  processedAt: string | null;
  createdAt: string;
}

function toDto(row: WithdrawalRequest): WithdrawalRequestDto {
  return {
    id: row.id,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    bankAccountId: row.bankAccountId,
    failureReason: row.failureReason,
    adminNote: row.adminNote,
    processedAt: row.processedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * See docs/WALLET-004-WITHDRAW-DESIGN.md. The wallet is debited at request
 * creation (PENDING), not at completion — a FAILED outcome reverses the
 * debit via WalletService.credit(), referencing the same WithdrawalRequest
 * id so the reversal is idempotent. Phase 1 has no automated payout; a real
 * admin queue (see AdminWithdrawalController) fulfills requests manually
 * until Phase 2's PayoutProvider is wired to real credentials.
 */
/**
 * Which commission ledger a wallet belongs to. Customers have none — they owe
 * DrippleX nothing on a payout of their own topped-up balance.
 */
const COMMISSION_OWNER_BY_WALLET_OWNER: Partial<Record<WalletOwnerType, CommissionOwnerType>> = {
  [WalletOwnerType.RIDER]: CommissionOwnerType.RIDER,
  [WalletOwnerType.DRIVER]: CommissionOwnerType.DRIVER,
};

@Injectable()
export class WithdrawalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly bankAccountsService: BankAccountsService,
    private readonly walletPinService: WalletPinService,
    private readonly auditService: AuditService,
    private readonly eventBus: DomainEventBus,
    private readonly commissionAccounts: CommissionAccountService,
  ) {}

  /**
   * A payout request from any wallet-holding party.
   *
   * `ownerType` used to be hard-coded to CUSTOMER, which meant a driver or
   * rider requesting a payout would have had their (empty) *customer* wallet
   * debited while their earnings sat untouched in the DRIVER/RIDER wallet the
   * settlement services actually credit. Every caller now states whose wallet
   * this is, and the reversal path below resolves it from the debited wallet
   * itself rather than assuming.
   */
  public async create(
    userId: string,
    ownerType: WalletOwnerType,
    input: { amount: number; bankAccountId: string; pin: string },
    context?: AuditContext,
  ): Promise<PayoutResultDto> {
    if (
      input.amount < WALLET_WITHDRAWAL_MIN_AMOUNT ||
      input.amount > WALLET_WITHDRAWAL_MAX_AMOUNT
    ) {
      throw new ValidationDomainException(
        `Amount must be between ${String(WALLET_WITHDRAWAL_MIN_AMOUNT)} and ${String(WALLET_WITHDRAWAL_MAX_AMOUNT)}`,
      );
    }

    await this.walletService.assertWithinLimits(ownerType, userId, input.amount);
    await this.walletPinService.verify(userId, input.pin);
    await this.bankAccountsService.assertOwned(userId, input.bankAccountId);

    const wallet = await this.walletService.getWallet(ownerType, userId);

    // DPX-PAYOUT-002 — what a rider or driver owes DrippleX on cash jobs comes
    // out of their payout before anything reaches their bank. Founder decision
    // (2026-08-17): "commission should be subtracted before pay out."
    //
    // Deliberately settled here rather than merely displayed on the Ops report:
    // a debt that depends on somebody remembering to subtract it by hand is a
    // debt that quietly stops being collected. Settling at the moment money
    // moves also means a partner who clears to zero is unblocked immediately,
    // by the same write.
    const commissionSettled = await this.settleCommissionFromPayout(
      userId,
      ownerType,
      input.amount,
      wallet.currency,
      context,
    );
    const payable = Number((input.amount - commissionSettled).toFixed(2));

    if (payable <= 0) {
      // The whole request went to clearing what they owed. No bank transfer to
      // make, so no line on the settlement run — telling Operations to send ₦0
      // would be worse than telling them nothing.
      return { commissionSettled, payout: null };
    }

    const created = await this.prisma.withdrawalRequest.create({
      data: {
        userId,
        walletId: wallet.id,
        bankAccountId: input.bankAccountId,
        amount: payable,
        currency: wallet.currency,
        status: WithdrawalRequestStatus.PENDING,
      },
    });

    try {
      await this.walletService.withdrawal({
        ownerType,
        ownerId: userId,
        amount: payable,
        currency: wallet.currency,
        referenceType: WALLET_WITHDRAWAL_REFERENCE_TYPE,
        referenceId: created.id,
        description: 'Wallet withdrawal',
        ...(context !== undefined ? { context } : {}),
      });
    } catch (error) {
      await this.prisma.withdrawalRequest.update({
        where: { id: created.id },
        data: {
          status: WithdrawalRequestStatus.FAILED,
          failureReason: error instanceof Error ? error.message : 'Debit failed',
          processedAt: new Date(),
        },
      });
      throw error;
    }

    await this.auditService.record(
      WALLET_AUDIT_ACTIONS.WITHDRAWAL_REQUESTED,
      { ...(context ?? {}), userId },
      {
        resource: 'withdrawal_request',
        resourceId: created.id,
        metadata: { requested: input.amount, commissionSettled, amount: payable },
      },
    );

    await this.eventBus.emit(
      DOMAIN_EVENTS.WITHDRAWAL_REQUESTED,
      { withdrawalId: created.id, userId, amount: String(payable) },
      { actorUserId: userId },
    );

    return { commissionSettled, payout: toDto(created) };
  }

  /**
   * Take what this partner owes DrippleX out of the payout, up to the amount
   * they asked for, and return how much was taken.
   *
   * Only riders and drivers carry a commission account — a customer paying
   * their own topped-up balance out owes DrippleX nothing, so their payout is
   * never touched.
   *
   * The wallet debit and the commission credit are two separate, individually
   * meaningful movements: the ledger shows the partner what left their balance
   * and why, and the commission account shows the debt going down. Ordered
   * wallet-first so a failure to record the payment cannot leave a partner
   * credited for money that never left their balance.
   */
  private async settleCommissionFromPayout(
    userId: string,
    ownerType: WalletOwnerType,
    requested: number,
    currency: string,
    context?: AuditContext,
  ): Promise<number> {
    const commissionOwner = COMMISSION_OWNER_BY_WALLET_OWNER[ownerType];
    if (commissionOwner === undefined) {
      return 0;
    }

    const account = await this.commissionAccounts.getOrCreateAccount(commissionOwner, userId);
    const outstanding = Number(account.outstandingBalance);
    if (outstanding <= 0) {
      return 0;
    }

    const settled = Number(Math.min(outstanding, requested).toFixed(2));
    if (settled <= 0) {
      return 0;
    }

    const reference = randomUUID();
    await this.walletService.debit({
      ownerType,
      ownerId: userId,
      amount: settled,
      currency,
      referenceType: WALLET_COMMISSION_SETTLEMENT_REFERENCE_TYPE,
      referenceId: reference,
      description: 'Settled against commission owed on cash jobs',
      ...(context !== undefined ? { context } : {}),
    });

    await this.commissionAccounts.recordPayment({
      ownerType: commissionOwner,
      ownerId: userId,
      amount: settled,
      referenceType: WALLET_COMMISSION_SETTLEMENT_REFERENCE_TYPE,
      referenceId: reference,
      description: 'Deducted from a payout request',
      recordedBy: userId,
      ...(context !== undefined ? { context } : {}),
    });

    return settled;
  }

  public async listForUser(
    userId: string,
    page: number,
    pageSize: number,
    status?: WithdrawalRequestStatus,
  ): Promise<PaginatedResult<WithdrawalRequestDto>> {
    const where = { userId, ...(status !== undefined ? { status } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.withdrawalRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.withdrawalRequest.count({ where }),
    ]);
    return {
      items: items.map(toDto),
      meta: { page, limit: pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  public async getForUser(userId: string, id: string): Promise<WithdrawalRequestDto> {
    const row = await this.prisma.withdrawalRequest.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundDomainException('Withdrawal request not found');
    }
    if (row.userId !== userId) {
      throw new ForbiddenDomainException('Not your withdrawal request');
    }
    return toDto(row);
  }

  public async listForAdmin(
    page: number,
    pageSize: number,
    status?: WithdrawalRequestStatus,
  ): Promise<PaginatedResult<WithdrawalRequestDto>> {
    const where = status !== undefined ? { status } : {};
    const [items, total] = await Promise.all([
      this.prisma.withdrawalRequest.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.withdrawalRequest.count({ where }),
    ]);
    return {
      items: items.map(toDto),
      meta: { page, limit: pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  public async adminComplete(
    adminUserId: string,
    id: string,
    adminNote: string | undefined,
    context?: AuditContext,
  ): Promise<WithdrawalRequestDto> {
    const row = await this.prisma.withdrawalRequest.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundDomainException('Withdrawal request not found');
    }
    if (row.status !== WithdrawalRequestStatus.PENDING) {
      throw new ValidationDomainException(`Cannot complete a ${row.status.toLowerCase()} request`);
    }

    const updated = await this.prisma.withdrawalRequest.update({
      where: { id },
      data: {
        status: WithdrawalRequestStatus.COMPLETED,
        adminNote: adminNote ?? null,
        processedByUserId: adminUserId,
        processedAt: new Date(),
      },
    });

    await this.auditService.record(
      WALLET_AUDIT_ACTIONS.WITHDRAWAL_COMPLETED,
      { ...(context ?? {}), userId: adminUserId },
      { resource: 'withdrawal_request', resourceId: id },
    );

    await this.eventBus.emit(
      DOMAIN_EVENTS.WITHDRAWAL_COMPLETED,
      { withdrawalId: id, userId: row.userId, amount: String(row.amount) },
      { actorUserId: adminUserId },
    );

    return toDto(updated);
  }

  public async adminFail(
    adminUserId: string,
    id: string,
    reason: string,
    context?: AuditContext,
  ): Promise<WithdrawalRequestDto> {
    const row = await this.prisma.withdrawalRequest.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundDomainException('Withdrawal request not found');
    }
    if (row.status !== WithdrawalRequestStatus.PENDING) {
      throw new ValidationDomainException(`Cannot fail a ${row.status.toLowerCase()} request`);
    }

    const updated = await this.prisma.withdrawalRequest.update({
      where: { id },
      data: {
        status: WithdrawalRequestStatus.FAILED,
        failureReason: reason,
        processedByUserId: adminUserId,
        processedAt: new Date(),
      },
    });

    // Credit back the wallet that was actually debited — read from the request's
    // own walletId. Assuming CUSTOMER here would silently move a failed driver
    // payout into the wrong wallet and leave the driver short.
    const debitedWallet = await this.prisma.wallet.findUnique({ where: { id: row.walletId } });
    if (!debitedWallet) {
      throw new NotFoundDomainException('Wallet for this withdrawal no longer exists');
    }

    await this.walletService.credit({
      ownerType: debitedWallet.ownerType,
      ownerId: debitedWallet.ownerId,
      amount: Number(row.amount),
      currency: row.currency,
      referenceType: WALLET_WITHDRAWAL_REVERSAL_REFERENCE_TYPE,
      referenceId: id,
      description: `Withdrawal reversed: ${reason}`,
      ...(context !== undefined ? { context } : {}),
    });

    await this.auditService.record(
      WALLET_AUDIT_ACTIONS.WITHDRAWAL_FAILED,
      { ...(context ?? {}), userId: adminUserId },
      { resource: 'withdrawal_request', resourceId: id, metadata: { reason } },
    );

    await this.eventBus.emit(
      DOMAIN_EVENTS.WITHDRAWAL_FAILED,
      { withdrawalId: id, userId: row.userId, amount: String(row.amount), reason },
      { actorUserId: adminUserId },
    );

    return toDto(updated);
  }
}
