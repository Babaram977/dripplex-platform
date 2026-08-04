import { Injectable } from '@nestjs/common';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import { WALLET_AUDIT_ACTIONS } from './wallet.constants';

import type { CustomerBankAccount } from '@prisma/client';

export interface CustomerBankAccountDto {
  id: string;
  bankName: string;
  bankCode: string | null;
  accountName: string;
  accountNumber: string;
  isDefault: boolean;
  createdAt: string;
}

function toDto(row: CustomerBankAccount): CustomerBankAccountDto {
  return {
    id: row.id,
    bankName: row.bankName,
    bankCode: row.bankCode,
    accountName: row.accountName,
    accountNumber: row.accountNumber,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Customer-owned withdrawal destinations. Self-attested — no bank-account-
 * verification API is integrated anywhere in the platform yet, the same
 * trust level merchant `BankAccount` already operates at (see
 * docs/WALLET-004-WITHDRAW-DESIGN.md).
 */
@Injectable()
export class BankAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  public async list(userId: string): Promise<CustomerBankAccountDto[]> {
    const rows = await this.prisma.customerBankAccount.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(toDto);
  }

  public async add(
    userId: string,
    input: { bankName: string; bankCode?: string; accountName: string; accountNumber: string },
    context?: AuditContext,
  ): Promise<CustomerBankAccountDto> {
    const existing = await this.prisma.customerBankAccount.findFirst({
      where: { userId, accountNumber: input.accountNumber, deletedAt: null },
    });
    if (existing) {
      throw new ConflictDomainException('This account is already linked');
    }

    const isFirst =
      (await this.prisma.customerBankAccount.count({ where: { userId, deletedAt: null } })) === 0;

    const created = await this.prisma.customerBankAccount.create({
      data: {
        userId,
        bankName: input.bankName,
        bankCode: input.bankCode ?? null,
        accountName: input.accountName,
        accountNumber: input.accountNumber,
        isDefault: isFirst,
      },
    });

    await this.auditService.record(
      WALLET_AUDIT_ACTIONS.BANK_ACCOUNT_ADDED,
      { ...(context ?? {}), userId },
      { resource: 'customer_bank_account', resourceId: created.id },
    );

    return toDto(created);
  }

  public async setDefault(userId: string, bankAccountId: string): Promise<CustomerBankAccountDto> {
    const account = await this.prisma.customerBankAccount.findFirst({
      where: { id: bankAccountId, userId, deletedAt: null },
    });
    if (!account) {
      throw new NotFoundDomainException('Bank account not found');
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.customerBankAccount.updateMany({
        where: { userId, deletedAt: null },
        data: { isDefault: false },
      }),
      this.prisma.customerBankAccount.update({
        where: { id: bankAccountId },
        data: { isDefault: true },
      }),
    ]);

    return toDto(updated);
  }

  public async remove(
    userId: string,
    bankAccountId: string,
    context?: AuditContext,
  ): Promise<void> {
    const account = await this.prisma.customerBankAccount.findFirst({
      where: { id: bankAccountId, userId, deletedAt: null },
    });
    if (!account) {
      throw new NotFoundDomainException('Bank account not found');
    }

    const pendingWithdrawal = await this.prisma.withdrawalRequest.findFirst({
      where: { bankAccountId, status: 'PENDING' },
    });
    if (pendingWithdrawal) {
      throw new ValidationDomainException('Cannot remove a bank account with a pending withdrawal');
    }

    await this.prisma.customerBankAccount.update({
      where: { id: bankAccountId },
      data: { deletedAt: new Date(), isDefault: false },
    });

    if (account.isDefault) {
      const nextDefault = await this.prisma.customerBankAccount.findFirst({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });
      if (nextDefault) {
        await this.prisma.customerBankAccount.update({
          where: { id: nextDefault.id },
          data: { isDefault: true },
        });
      }
    }

    await this.auditService.record(
      WALLET_AUDIT_ACTIONS.BANK_ACCOUNT_REMOVED,
      { ...(context ?? {}), userId },
      { resource: 'customer_bank_account', resourceId: bankAccountId },
    );
  }

  /** Used by WithdrawalService to confirm the destination account belongs
   * to the requesting user before debiting the wallet. */
  public async assertOwned(userId: string, bankAccountId: string): Promise<CustomerBankAccount> {
    const account = await this.prisma.customerBankAccount.findFirst({
      where: { id: bankAccountId, userId, deletedAt: null },
    });
    if (!account) {
      throw new NotFoundDomainException('Bank account not found');
    }
    return account;
  }
}
