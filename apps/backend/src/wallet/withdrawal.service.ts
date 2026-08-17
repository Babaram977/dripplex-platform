import { Injectable } from '@nestjs/common';
import { WalletOwnerType, WithdrawalRequestStatus } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
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
  WALLET_WITHDRAWAL_REFERENCE_TYPE,
  WALLET_WITHDRAWAL_REVERSAL_REFERENCE_TYPE,
} from './wallet.constants';
import { WalletService } from './wallet.service';

import type { PaginatedResult } from '@dripplex/types';
import type { WithdrawalRequest } from '@prisma/client';

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
@Injectable()
export class WithdrawalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly bankAccountsService: BankAccountsService,
    private readonly walletPinService: WalletPinService,
    private readonly auditService: AuditService,
    private readonly eventBus: DomainEventBus,
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
  ): Promise<WithdrawalRequestDto> {
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

    const created = await this.prisma.withdrawalRequest.create({
      data: {
        userId,
        walletId: wallet.id,
        bankAccountId: input.bankAccountId,
        amount: input.amount,
        currency: wallet.currency,
        status: WithdrawalRequestStatus.PENDING,
      },
    });

    try {
      await this.walletService.withdrawal({
        ownerType,
        ownerId: userId,
        amount: input.amount,
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
        metadata: { amount: input.amount },
      },
    );

    await this.eventBus.emit(
      DOMAIN_EVENTS.WITHDRAWAL_REQUESTED,
      { withdrawalId: created.id, userId, amount: String(input.amount) },
      { actorUserId: userId },
    );

    return toDto(created);
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
