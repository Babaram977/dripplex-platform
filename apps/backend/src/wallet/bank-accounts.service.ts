import { Inject, Injectable } from '@nestjs/common';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import {
  BANK_ACCOUNT_RESOLVER,
  type BankAccountResolver,
  type BankOption,
} from './verification/bank-account-resolver.port';
import { WALLET_AUDIT_ACTIONS } from './wallet.constants';

import type { CustomerBankAccount } from '@prisma/client';

export interface CustomerBankAccountDto {
  id: string;
  bankName: string;
  bankCode: string | null;
  accountName: string;
  accountNumber: string;
  isDefault: boolean;
  /** True when the name was confirmed with the bank rather than typed by the
   * customer. False on rows saved before name enquiry existed, or added while
   * no resolver was configured — never "verification failed", because a
   * rejected account is not saved. Operations shows this on the withdrawal
   * queue so a manual transfer to an unconfirmed destination is a visible
   * choice rather than an invisible default. */
  accountNameVerified: boolean;
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
    accountNameVerified: row.accountNameVerifiedAt !== null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Customer-owned withdrawal destinations.
 *
 * These were self-attested until DPX-WALLET-001 Phase 0: the customer typed a
 * bank, a number and a name, and nothing checked that the three belonged
 * together. A transposed digit is a perfectly valid account number belonging
 * to a stranger, and the only thing between that and the money leaving was an
 * operator eyeballing the row before making a manual transfer — a safeguard
 * Phase 4 deletes when it automates payouts.
 *
 * So `add` now performs name enquiry when a resolver is configured, and the
 * bank's answer overwrites whatever the customer typed. An account the bank
 * will not confirm is refused rather than saved unverified.
 */
@Injectable()
export class BankAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Inject(BANK_ACCOUNT_RESOLVER)
    private readonly resolver: BankAccountResolver,
  ) {}

  /** The banks name enquiry can run against. Empty when no resolver is
   * configured, which the client reads as "ask for the bank name as text"
   * rather than as an error. */
  public async listBanks(): Promise<BankOption[]> {
    if (!this.resolver.configured) {
      return [];
    }
    return await this.resolver.listBanks();
  }

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

    const verified = await this.verifyAccountName(input);

    const created = await this.prisma.customerBankAccount.create({
      data: {
        userId,
        bankName: input.bankName,
        bankCode: input.bankCode ?? null,
        // The bank's answer wins. Storing the customer's own spelling next to
        // a number the bank says belongs to someone else is the failure this
        // whole phase exists to prevent.
        accountName: verified?.accountName ?? input.accountName,
        accountNumber: input.accountNumber,
        accountNameVerifiedAt: verified === null ? null : new Date(),
        isDefault: isFirst,
      },
    });

    await this.auditService.record(
      WALLET_AUDIT_ACTIONS.BANK_ACCOUNT_ADDED,
      { ...(context ?? {}), userId },
      {
        resource: 'customer_bank_account',
        resourceId: created.id,
        metadata: { accountNameVerified: verified !== null },
      },
    );

    return toDto(created);
  }

  /**
   * Ask the bank who owns this number. Null means nobody asked — not that the
   * answer was no.
   *
   * A `bankCode` is required to ask at all: the same ten digits exist at every
   * Nigerian bank, so resolving without one is meaningless. When the resolver
   * is live but the client sent no code, that is a client that has not adopted
   * the bank picker yet, and it is refused rather than quietly saved
   * unverified — silently downgrading the guarantee is how this protection
   * would rot.
   */
  private async verifyAccountName(input: {
    bankCode?: string;
    accountNumber: string;
  }): Promise<{ accountName: string } | null> {
    if (!this.resolver.configured) {
      return null;
    }
    const bankCode = input.bankCode?.trim();
    if (bankCode === undefined || bankCode === '') {
      throw new ValidationDomainException(
        'Choose your bank from the list so we can confirm the account name',
      );
    }
    return await this.resolver.resolveAccountName({
      accountNumber: input.accountNumber,
      bankCode,
    });
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
