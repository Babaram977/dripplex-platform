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
import { requireBank } from './verification/bank-directory';
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
 * Keep the partner payout flow compatible with the existing app while the
 * bank picker is being rolled out. Drivers and riders currently send a bank
 * name, not a bank code. When verification is configured, translate that
 * name to the canonical Paystack bank option server-side before resolving the
 * account. This preserves the verification guarantee instead of falling back
 * to an unverified account.
 */
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

  /**
   * Name enquiry on its own, with nothing stored.
   *
   * `add` already refuses to save an account the bank will not confirm, but by
   * then the person has committed. Exposing the same enquiry lets the form show
   * the bank's answer while they are still looking at it, so the account name
   * stops being something anyone types.
   *
   * Returns the canonical bank alongside the name, because the caller needs to
   * send back exactly what was verified rather than what it displayed.
   */
  public async resolveAccount(input: {
    bankName?: string;
    bankCode?: string;
    accountNumber: string;
  }): Promise<{ accountName: string; bankName: string; bankCode: string }> {
    if (!this.resolver.configured) {
      throw new ValidationDomainException('Bank verification is not configured');
    }

    const bank = requireBank(await this.resolver.listBanks(), {
      bankName: input.bankName,
      bankCode: input.bankCode,
    });
    const resolved = await this.resolver.resolveAccountName({
      accountNumber: input.accountNumber,
      bankCode: bank.code,
    });

    return { accountName: resolved.accountName, bankName: bank.name, bankCode: bank.code };
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
        // Store the canonical bank name when we resolved a free-text partner
        // submission. This keeps Operations' payout queue consistent.
        bankName: verified?.bankName ?? input.bankName,
        bankCode: verified?.bankCode ?? input.bankCode ?? null,
        // Records which rail issued this code. Codes are provider-specific, and
        // the payout path refuses to hand one rail's code to the other without
        // re-confirming it first.
        bankCodeProvider: 'PAYSTACK',
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
   * When the resolver is live, older partner clients may still send only the
   * bank name. We resolve that name against the provider's canonical bank list
   * here, then always perform the same account-name enquiry. No verified
   * account can bypass the resolver merely because the UI has not yet shipped
   * the bank-code picker.
   */
  private async verifyAccountName(input: {
    bankName: string;
    bankCode?: string;
    accountNumber: string;
  }): Promise<{ accountName: string; bankCode: string; bankName: string } | null> {
    if (!this.resolver.configured) {
      return null;
    }

    let bankCode = input.bankCode?.trim();
    let bankName = input.bankName.trim();

    if (!bankCode) {
      const match = requireBank(await this.resolver.listBanks(), { bankName });
      bankCode = match.code;
      bankName = match.name;
    }

    const resolved = await this.resolver.resolveAccountName({
      accountNumber: input.accountNumber,
      bankCode,
    });

    return { ...resolved, bankCode, bankName };
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
