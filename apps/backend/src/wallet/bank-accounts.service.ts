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
   * customer. Always true for anything linked since verification became
   * mandatory (2026-09-11); false only on historical rows saved before that.
   * Never "verification failed" — a rejected account is not saved at all.
   * Operations shows this on the withdrawal queue, so paying out by hand to one
   * of those older unconfirmed destinations stays a visible choice rather than
   * an invisible default. */
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
 * So `add` performs name enquiry — always, as of the founder decision of
 * 2026-09-11 — and the bank's answer overwrites whatever the customer typed. An
 * account the bank will not confirm is refused rather than saved unverified,
 * and an environment that cannot ask is refused too.
 *
 * This service backs three personas: customers, riders and drivers. They were
 * the last ones able to self-attest a payout destination; merchants and fleets
 * had already been tightened.
 */
@Injectable()
export class BankAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Inject(BANK_ACCOUNT_RESOLVER)
    private readonly resolver: BankAccountResolver,
  ) {}

  /** The banks name enquiry can run against.
   *
   * Empty when no resolver is configured. That used to mean "fall back to a
   * free-text bank name"; it now means the form has nothing to offer and should
   * say so, because `add` refuses outright in that state. A client that still
   * falls back to free text is building a form that cannot succeed. */
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

  /**
   * Link a withdrawal destination.
   *
   * Founder decision 2026-09-11, overriding the Phase 0 compromise: **every
   * bank input is verified with the payout provider.** There is no
   * self-attested path any more, for any persona.
   *
   * What that replaced: when no resolver was configured this stored the
   * customer's own typing with `accountNameVerifiedAt: null`, on the reasoning
   * that degrading was kinder than refusing. It was not. `PayoutFulfillment`
   * already refuses an unverified destination, so such a row was never a
   * working account — it was a withdrawal that failed late, or one an operator
   * paid out by hand to a name nobody had checked. The merchant and fleet paths
   * had already been tightened; customers, riders and drivers were the three
   * personas still on the lenient one.
   *
   * An unconfigured resolver is now a refusal, and a loud one. That is the
   * intended behaviour: an environment that cannot verify a payout destination
   * must not be collecting them.
   */
  public async add(
    userId: string,
    input: { bankName: string; bankCode?: string; accountName?: string; accountNumber: string },
    context?: AuditContext,
  ): Promise<CustomerBankAccountDto> {
    if (!this.resolver.configured) {
      throw new ValidationDomainException('Bank verification is not configured');
    }

    const accountNumber = input.accountNumber.trim();
    // NUBAN is exactly ten digits. Anything else cannot be resolved, so
    // accepting it only defers the failure to somewhere less helpful.
    if (!/^\d{10}$/.test(accountNumber)) {
      throw new ValidationDomainException('Nigerian bank account number must contain 10 digits');
    }

    const existing = await this.prisma.customerBankAccount.findFirst({
      where: { userId, accountNumber, deletedAt: null },
    });
    if (existing) {
      throw new ConflictDomainException('This account is already linked');
    }

    const isFirst =
      (await this.prisma.customerBankAccount.count({ where: { userId, deletedAt: null } })) === 0;

    // Throws when the bank does not recognise the account. Nothing is stored.
    const verified = await this.verifyAccountName({ ...input, accountNumber });

    const created = await this.prisma.customerBankAccount.create({
      data: {
        userId,
        // All three of these are the bank's answer, not the customer's typing.
        bankName: verified.bankName,
        bankCode: verified.bankCode,
        // Records which rail issued this code. Codes are provider-specific, and
        // the payout path refuses to hand one rail's code to the other without
        // re-confirming it first.
        bankCodeProvider: 'PAYSTACK',
        accountName: verified.accountName,
        accountNumber,
        accountNameVerifiedAt: new Date(),
        isDefault: isFirst,
      },
    });

    await this.auditService.record(
      WALLET_AUDIT_ACTIONS.BANK_ACCOUNT_ADDED,
      { ...(context ?? {}), userId },
      {
        resource: 'customer_bank_account',
        resourceId: created.id,
        metadata: { accountNameVerified: true },
      },
    );

    return toDto(created);
  }

  /**
   * Ask the bank who owns this number, or throw.
   *
   * Older partner clients may still send only a bank name. That name is
   * resolved against the provider's canonical list here, and then the same
   * account-name enquiry runs either way — so an account cannot skip the
   * resolver merely because a client has not shipped the bank-code picker yet.
   *
   * There is no longer a null return. Not asking is not an outcome.
   */
  private async verifyAccountName(input: {
    bankName: string;
    bankCode?: string;
    accountNumber: string;
  }): Promise<{ accountName: string; bankCode: string; bankName: string }> {
    const requestedCode = input.bankCode?.trim();
    const bank = requireBank(await this.resolver.listBanks(), {
      ...(requestedCode === undefined || requestedCode === '' ? {} : { bankCode: requestedCode }),
      bankName: input.bankName.trim(),
    });

    const resolved = await this.resolver.resolveAccountName({
      accountNumber: input.accountNumber,
      bankCode: bank.code,
    });

    return { ...resolved, bankCode: bank.code, bankName: bank.name };
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
