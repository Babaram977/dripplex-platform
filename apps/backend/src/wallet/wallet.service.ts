import { Injectable } from '@nestjs/common';
import { Prisma, WalletDirection, WalletOwnerType, WalletTransactionType } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ConflictDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';
import { PrismaService } from '../prisma/prisma.service';

import { WALLET_AUDIT_ACTIONS, WALLET_DEFAULT_CURRENCY } from './wallet.constants';

import type { PaginatedResult } from '@dripplex/types';
import type { Wallet, WalletLedgerEntry } from '@prisma/client';

type WalletTx = Prisma.TransactionClient;
interface WalletMutationResult {
  wallet: Wallet;
  ledger: WalletLedgerEntry;
  applied: boolean;
}

export interface WalletDto {
  id: string;
  ownerType: WalletOwnerType;
  ownerId: string;
  currency: string;
  availableBalance: number;
  pendingBalance: number;
  version: number;
  dailyLimit: number | null;
  singleTransactionLimit: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface WalletStatementDto {
  month: number;
  year: number;
  totalIn: number;
  totalOut: number;
  net: number;
  transactions: WalletLedgerEntryDto[];
}

export interface WalletLedgerEntryDto {
  id: string;
  walletId: string;
  type: WalletTransactionType;
  amount: number;
  direction: WalletDirection;
  balanceAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: string;
}

export interface WalletMutationInput {
  ownerType: WalletOwnerType;
  ownerId: string;
  amount: number | string | Prisma.Decimal;
  currency?: string;
  description?: string;
  referenceType?: string;
  referenceId?: string;
  metadata?: Prisma.InputJsonValue;
  context?: AuditContext;
}

export interface WalletReconciliationDto {
  wallet: WalletDto;
  ledgerBalance: number;
  availableBalance: number;
  difference: number;
  reconciled: boolean;
}

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventBus: DomainEventBus,
  ) {}

  public async getOrCreateWallet(
    ownerType: WalletOwnerType,
    ownerId: string,
    currency = WALLET_DEFAULT_CURRENCY,
  ): Promise<WalletDto> {
    const wallet = await this.prisma.wallet.upsert({
      where: {
        ownerType_ownerId_currency: {
          ownerType,
          ownerId,
          currency: this.normalizeCurrency(currency),
        },
      },
      update: { deletedAt: null },
      create: {
        ownerType,
        ownerId,
        currency: this.normalizeCurrency(currency),
      },
    });
    return toWalletDto(wallet);
  }

  public async getWallet(
    ownerType: WalletOwnerType,
    ownerId: string,
    currency = WALLET_DEFAULT_CURRENCY,
  ): Promise<WalletDto> {
    return await this.getOrCreateWallet(ownerType, ownerId, currency);
  }

  public async credit(input: WalletMutationInput): Promise<WalletDto> {
    return await this.mutateAndEmit(input, WalletTransactionType.CREDIT, WalletDirection.CREDIT);
  }

  public async debit(input: WalletMutationInput): Promise<WalletDto> {
    return await this.mutateAndEmit(input, WalletTransactionType.DEBIT, WalletDirection.DEBIT);
  }

  public async refund(input: WalletMutationInput): Promise<WalletDto> {
    return await this.mutateAndEmit(input, WalletTransactionType.REFUND, WalletDirection.CREDIT);
  }

  public async settlement(input: WalletMutationInput): Promise<WalletDto> {
    return await this.mutateAndEmit(
      input,
      WalletTransactionType.SETTLEMENT,
      WalletDirection.CREDIT,
    );
  }

  public async cashback(input: WalletMutationInput): Promise<WalletDto> {
    return await this.mutateAndEmit(input, WalletTransactionType.CASHBACK, WalletDirection.CREDIT);
  }

  public async withdrawal(input: WalletMutationInput): Promise<WalletDto> {
    return await this.mutateAndEmit(input, WalletTransactionType.WITHDRAWAL, WalletDirection.DEBIT);
  }

  public async transfer(input: {
    fromOwnerType: WalletOwnerType;
    fromOwnerId: string;
    toOwnerType: WalletOwnerType;
    toOwnerId: string;
    amount: number | string | Prisma.Decimal;
    currency?: string;
    description?: string;
    context?: AuditContext;
  }): Promise<{ source: WalletDto; destination: WalletDto }> {
    if (input.fromOwnerType === input.toOwnerType && input.fromOwnerId === input.toOwnerId) {
      throw new ValidationDomainException('Cannot transfer to the same wallet');
    }

    const currency = this.normalizeCurrency(input.currency);
    const amount = this.toPositiveDecimal(input.amount);
    const result = await this.prisma.$transaction(async (tx) => {
      const source = await this.applyMutation(tx, {
        ownerType: input.fromOwnerType,
        ownerId: input.fromOwnerId,
        currency,
        amount,
        type: WalletTransactionType.TRANSFER,
        direction: WalletDirection.DEBIT,
        description: input.description ?? 'Wallet transfer',
        metadata: { toOwnerType: input.toOwnerType, toOwnerId: input.toOwnerId },
      });
      const destination = await this.applyMutation(tx, {
        ownerType: input.toOwnerType,
        ownerId: input.toOwnerId,
        currency,
        amount,
        type: WalletTransactionType.TRANSFER,
        direction: WalletDirection.CREDIT,
        description: input.description ?? 'Wallet transfer',
        metadata: { fromOwnerType: input.fromOwnerType, fromOwnerId: input.fromOwnerId },
      });
      return { source, destination };
    });

    await this.auditService.record(
      WALLET_AUDIT_ACTIONS.TRANSFERRED,
      { ...(input.context ?? {}), userId: input.fromOwnerId },
      {
        resource: 'wallet',
        resourceId: result.source.wallet.id,
        metadata: {
          destinationWalletId: result.destination.wallet.id,
          amount: amount.toNumber(),
          currency,
        },
      },
    );

    await Promise.all([
      this.emitWalletEvent(
        DOMAIN_EVENTS.WALLET_DEBITED,
        result.source.wallet,
        result.source.ledger,
      ),
      this.emitWalletEvent(
        DOMAIN_EVENTS.WALLET_CREDITED,
        result.destination.wallet,
        result.destination.ledger,
      ),
    ]);

    return {
      source: toWalletDto(result.source.wallet),
      destination: toWalletDto(result.destination.wallet),
    };
  }

  public async listHistory(
    ownerType: WalletOwnerType,
    ownerId: string,
    page: number,
    pageSize: number,
    currency = WALLET_DEFAULT_CURRENCY,
    type?: WalletTransactionType,
  ): Promise<PaginatedResult<WalletLedgerEntryDto>> {
    const wallet = await this.getOrCreateWalletRecord(ownerType, ownerId, currency);
    const where: Prisma.WalletLedgerEntryWhereInput = {
      walletId: wallet.id,
      ...(type !== undefined ? { type } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.walletLedgerEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.walletLedgerEntry.count({ where }),
    ]);

    return {
      items: items.map(toWalletLedgerEntryDto),
      meta: {
        page,
        limit: pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
      },
    };
  }

  /** Real, persisted spending limits (Wallet Settings). Null clears a
   * limit. Only meaningful bounds are enforced here — actual enforcement
   * happens in `assertWithinLimits`, called from Transfer and Withdrawal
   * request-creation, the two customer-initiated outflow paths; the
   * generic `debit()` used for ride/marketplace wallet payments is
   * deliberately not gated by these limits (see
   * docs/WALLET-005-STATEMENT-SECURITY-SETTINGS-DESIGN.md). */
  public async setLimits(
    ownerType: WalletOwnerType,
    ownerId: string,
    limits: { dailyLimit: number | null; singleTransactionLimit: number | null },
    context?: AuditContext,
  ): Promise<WalletDto> {
    if (limits.dailyLimit !== null && limits.dailyLimit <= 0) {
      throw new ValidationDomainException('Daily limit must be greater than zero');
    }
    if (limits.singleTransactionLimit !== null && limits.singleTransactionLimit <= 0) {
      throw new ValidationDomainException('Single transaction limit must be greater than zero');
    }

    const wallet = await this.getOrCreateWalletRecord(ownerType, ownerId);
    const updated = await this.prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        dailyLimit: limits.dailyLimit,
        singleTransactionLimit: limits.singleTransactionLimit,
      },
    });

    await this.auditService.record(
      WALLET_AUDIT_ACTIONS.LIMITS_UPDATED,
      { ...(context ?? {}), userId: ownerId },
      {
        resource: 'wallet',
        resourceId: wallet.id,
        metadata: limits,
      },
    );

    return toWalletDto(updated);
  }

  /** Throws ValidationDomainException when `amount` would exceed either
   * configured limit. Daily usage sums today's WITHDRAWAL + TRANSFER debit
   * ledger entries only — the same customer-initiated-outflow scope the
   * limits are set for, excluding ride/marketplace wallet payment debits
   * (type DEBIT), which are system-initiated at checkout, not a customer
   * "spend" the settings screen is describing. */
  public async assertWithinLimits(
    ownerType: WalletOwnerType,
    ownerId: string,
    amount: number,
    currency = WALLET_DEFAULT_CURRENCY,
  ): Promise<void> {
    const wallet = await this.getOrCreateWalletRecord(ownerType, ownerId, currency);

    if (wallet.singleTransactionLimit !== null) {
      const singleLimit = Number(wallet.singleTransactionLimit);
      if (amount > singleLimit) {
        throw new ValidationDomainException(
          `Amount exceeds your single transaction limit of ${String(singleLimit)}`,
        );
      }
    }

    if (wallet.dailyLimit !== null) {
      const dailyLimit = Number(wallet.dailyLimit);
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const spentToday = await this.prisma.walletLedgerEntry.aggregate({
        where: {
          walletId: wallet.id,
          direction: WalletDirection.DEBIT,
          type: { in: [WalletTransactionType.WITHDRAWAL, WalletTransactionType.TRANSFER] },
          createdAt: { gte: startOfToday },
        },
        _sum: { amount: true },
      });
      const alreadySpent = Number(spentToday._sum.amount ?? 0);
      if (alreadySpent + amount > dailyLimit) {
        throw new ValidationDomainException(
          `Amount would exceed your daily limit of ${String(dailyLimit)} (${String(alreadySpent)} already used today)`,
        );
      }
    }
  }

  /** Real aggregation over existing ledger entries — Money In/Out/Net and
   * the transaction list for one calendar month, in the owner's timezone-
   * naive server time (matches the rest of the platform's date handling,
   * no per-user timezone stored anywhere yet). */
  public async getStatement(
    ownerType: WalletOwnerType,
    ownerId: string,
    month: number,
    year: number,
    currency = WALLET_DEFAULT_CURRENCY,
  ): Promise<WalletStatementDto> {
    const wallet = await this.getOrCreateWalletRecord(ownerType, ownerId, currency);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const transactions = await this.prisma.walletLedgerEntry.findMany({
      where: { walletId: wallet.id, createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: 'desc' },
    });

    const totalIn = transactions
      .filter((tx) => tx.direction === WalletDirection.CREDIT)
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    const totalOut = transactions
      .filter((tx) => tx.direction === WalletDirection.DEBIT)
      .reduce((sum, tx) => sum + Number(tx.amount), 0);

    return {
      month,
      year,
      totalIn: roundMoney(totalIn),
      totalOut: roundMoney(totalOut),
      net: roundMoney(totalIn - totalOut),
      transactions: transactions.map(toWalletLedgerEntryDto),
    };
  }

  public async reconcileWallet(
    ownerType: WalletOwnerType,
    ownerId: string,
    currency = WALLET_DEFAULT_CURRENCY,
  ): Promise<WalletReconciliationDto> {
    const wallet = await this.getOrCreateWalletRecord(ownerType, ownerId, currency);
    const [credits, debits] = await Promise.all([
      this.prisma.walletLedgerEntry.aggregate({
        where: { walletId: wallet.id, direction: WalletDirection.CREDIT },
        _sum: { amount: true },
      }),
      this.prisma.walletLedgerEntry.aggregate({
        where: { walletId: wallet.id, direction: WalletDirection.DEBIT },
        _sum: { amount: true },
      }),
    ]);
    const ledgerBalance = new Prisma.Decimal(credits._sum.amount ?? 0).minus(
      debits._sum.amount ?? 0,
    );
    const availableBalance = new Prisma.Decimal(wallet.availableBalance);
    const difference = availableBalance.minus(ledgerBalance);

    await this.auditService.record(
      WALLET_AUDIT_ACTIONS.RECONCILED,
      {},
      {
        resource: 'wallet',
        resourceId: wallet.id,
        metadata: { difference: difference.toNumber() },
      },
    );

    return {
      wallet: toWalletDto(wallet),
      ledgerBalance: ledgerBalance.toNumber(),
      availableBalance: availableBalance.toNumber(),
      difference: difference.toNumber(),
      reconciled: difference.equals(0),
    };
  }

  private async mutateAndEmit(
    input: WalletMutationInput,
    type: WalletTransactionType,
    direction: WalletDirection,
  ): Promise<WalletDto> {
    const amount = this.toPositiveDecimal(input.amount);
    const currency = this.normalizeCurrency(input.currency);
    const actorUserId = input.context?.userId ?? input.ownerId;
    const result = await this.prisma.$transaction(
      async (tx) =>
        await this.applyMutation(tx, {
          ownerType: input.ownerType,
          ownerId: input.ownerId,
          currency,
          amount,
          type,
          direction,
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.referenceType !== undefined ? { referenceType: input.referenceType } : {}),
          ...(input.referenceId !== undefined ? { referenceId: input.referenceId } : {}),
          ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
        }),
    );

    if (!result.applied) {
      return toWalletDto(result.wallet);
    }

    await this.auditService.record(
      direction === WalletDirection.CREDIT
        ? WALLET_AUDIT_ACTIONS.CREDITED
        : WALLET_AUDIT_ACTIONS.DEBITED,
      { ...(input.context ?? {}), userId: actorUserId },
      {
        resource: 'wallet',
        resourceId: result.wallet.id,
        metadata: {
          ownerType: input.ownerType,
          ownerId: input.ownerId,
          type,
          direction,
          amount: amount.toNumber(),
          currency,
          referenceType: input.referenceType ?? null,
          referenceId: input.referenceId ?? null,
        },
      },
    );

    await this.emitWalletEvent(
      direction === WalletDirection.CREDIT
        ? DOMAIN_EVENTS.WALLET_CREDITED
        : DOMAIN_EVENTS.WALLET_DEBITED,
      result.wallet,
      result.ledger,
    );

    return toWalletDto(result.wallet);
  }

  private async applyMutation(
    tx: WalletTx,
    input: {
      ownerType: WalletOwnerType;
      ownerId: string;
      currency: string;
      amount: Prisma.Decimal;
      type: WalletTransactionType;
      direction: WalletDirection;
      description?: string;
      referenceType?: string;
      referenceId?: string;
      metadata?: Prisma.InputJsonValue;
    },
  ): Promise<WalletMutationResult> {
    const wallet = await this.getOrCreateWalletRecordInTx(
      tx,
      input.ownerType,
      input.ownerId,
      input.currency,
    );

    if (input.referenceType !== undefined && input.referenceId !== undefined) {
      const existingLedger = await tx.walletLedgerEntry.findFirst({
        where: {
          walletId: wallet.id,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
        },
      });
      if (existingLedger) {
        const currentWallet = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
        return { wallet: currentWallet, ledger: existingLedger, applied: false };
      }
    }

    const currentBalance = new Prisma.Decimal(wallet.availableBalance);
    if (input.direction === WalletDirection.DEBIT && currentBalance.lessThan(input.amount)) {
      throw new ValidationDomainException('Insufficient wallet balance');
    }

    const nextBalance =
      input.direction === WalletDirection.CREDIT
        ? currentBalance.plus(input.amount)
        : currentBalance.minus(input.amount);

    const updatedRows = await tx.wallet.updateMany({
      where: {
        id: wallet.id,
        version: wallet.version,
        ...(input.direction === WalletDirection.DEBIT
          ? { availableBalance: { gte: input.amount } }
          : {}),
      },
      data: {
        availableBalance: nextBalance,
        version: { increment: 1 },
      },
    });
    if (updatedRows.count !== 1) {
      throw new ConflictDomainException('Wallet balance changed; retry operation');
    }

    const ledger = await tx.walletLedgerEntry.create({
      data: {
        walletId: wallet.id,
        type: input.type,
        amount: input.amount,
        direction: input.direction,
        balanceAfter: nextBalance,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        description: input.description ?? null,
        metadata: input.metadata ?? Prisma.JsonNull,
      },
    });
    const updatedWallet = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    return { wallet: updatedWallet, ledger, applied: true };
  }

  private async getOrCreateWalletRecord(
    ownerType: WalletOwnerType,
    ownerId: string,
    currency = WALLET_DEFAULT_CURRENCY,
  ): Promise<Wallet> {
    return await this.prisma.wallet.upsert({
      where: {
        ownerType_ownerId_currency: {
          ownerType,
          ownerId,
          currency: this.normalizeCurrency(currency),
        },
      },
      update: { deletedAt: null },
      create: {
        ownerType,
        ownerId,
        currency: this.normalizeCurrency(currency),
      },
    });
  }

  private async getOrCreateWalletRecordInTx(
    tx: WalletTx,
    ownerType: WalletOwnerType,
    ownerId: string,
    currency = WALLET_DEFAULT_CURRENCY,
  ): Promise<Wallet> {
    return await tx.wallet.upsert({
      where: {
        ownerType_ownerId_currency: {
          ownerType,
          ownerId,
          currency: this.normalizeCurrency(currency),
        },
      },
      update: { deletedAt: null },
      create: {
        ownerType,
        ownerId,
        currency: this.normalizeCurrency(currency),
      },
    });
  }

  private async emitWalletEvent(
    name: typeof DOMAIN_EVENTS.WALLET_CREDITED | typeof DOMAIN_EVENTS.WALLET_DEBITED,
    wallet: Wallet,
    ledger: WalletLedgerEntry,
  ): Promise<void> {
    await this.eventBus.emit(name, {
      walletId: wallet.id,
      ledgerEntryId: ledger.id,
      ownerType: wallet.ownerType,
      ownerId: wallet.ownerId,
      amount: Number(ledger.amount),
      direction: ledger.direction,
      type: ledger.type,
      balanceAfter: Number(ledger.balanceAfter),
      currency: wallet.currency,
    });
  }

  private toPositiveDecimal(value: number | string | Prisma.Decimal): Prisma.Decimal {
    const decimal = new Prisma.Decimal(value);
    if (!decimal.isFinite() || decimal.lessThanOrEqualTo(0)) {
      throw new ValidationDomainException('Wallet amount must be greater than zero');
    }
    return decimal;
  }

  private normalizeCurrency(currency = WALLET_DEFAULT_CURRENCY): string {
    return currency.trim().toUpperCase();
  }
}

export function toWalletDto(wallet: Wallet): WalletDto {
  return {
    id: wallet.id,
    ownerType: wallet.ownerType,
    ownerId: wallet.ownerId,
    currency: wallet.currency,
    availableBalance: Number(wallet.availableBalance),
    pendingBalance: Number(wallet.pendingBalance),
    version: wallet.version,
    dailyLimit: wallet.dailyLimit !== null ? Number(wallet.dailyLimit) : null,
    singleTransactionLimit:
      wallet.singleTransactionLimit !== null ? Number(wallet.singleTransactionLimit) : null,
    createdAt: wallet.createdAt.toISOString(),
    updatedAt: wallet.updatedAt.toISOString(),
  };
}

function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function toWalletLedgerEntryDto(entry: WalletLedgerEntry): WalletLedgerEntryDto {
  return {
    id: entry.id,
    walletId: entry.walletId,
    type: entry.type,
    amount: Number(entry.amount),
    direction: entry.direction,
    balanceAfter: Number(entry.balanceAfter),
    referenceType: entry.referenceType,
    referenceId: entry.referenceId,
    description: entry.description,
    metadata: entry.metadata,
    createdAt: entry.createdAt.toISOString(),
  };
}
