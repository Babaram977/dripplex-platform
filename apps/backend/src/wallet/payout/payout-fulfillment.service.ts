import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { WithdrawalRequestStatus } from '@prisma/client';

import { DomainEventBus } from '../../events/domain-event-bus';
import { DOMAIN_EVENTS, type DomainEvent } from '../../events/domain-events';
import { PrismaService } from '../../prisma/prisma.service';
import { WALLET_WITHDRAWAL_REVERSAL_REFERENCE_TYPE } from '../wallet.constants';
import { WalletService } from '../wallet.service';

import { PAYOUT_PROVIDERS, type PayoutProvider } from './payout-provider.adapter';

@Injectable()
export class PayoutFulfillmentService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: DomainEventBus,
    private readonly walletService: WalletService,
    @Inject(PAYOUT_PROVIDERS) private readonly providers: PayoutProvider[],
  ) {}

  public onModuleInit(): void {
    this.eventBus.on(DOMAIN_EVENTS.WITHDRAWAL_REQUESTED, (event) => this.handleRequested(event));
  }

  private async handleRequested(event: DomainEvent): Promise<void> {
    const id = this.stringField(event, 'withdrawalId');
    if (id) await this.initiate(id);
  }

  /**
   * The verified account this payout is going to.
   *
   * A merchant's settlement account is in `bank_accounts`, everyone else's in
   * `customer_bank_accounts`, and a request carries exactly one of the two.
   * Null means there is no destination that can still be paid — deleted,
   * never confirmed by the bank, or missing the code the provider needs — and
   * the caller fails the payout rather than guessing at any of it.
   */
  private async destination(row: {
    bankAccountId: string | null;
    merchantBankAccountId: string | null;
  }): Promise<{ bankCode: string; accountNumber: string; accountName: string } | null> {
    if (row.merchantBankAccountId !== null) {
      const merchantAccount = await this.prisma.bankAccount.findUnique({
        where: { id: row.merchantBankAccountId },
      });
      if (merchantAccount === null) {
        return null;
      }
      if (merchantAccount.verifiedAt === null || merchantAccount.bankCode === null) {
        return null;
      }
      return {
        bankCode: merchantAccount.bankCode,
        accountNumber: merchantAccount.accountNumber,
        accountName: merchantAccount.accountName,
      };
    }

    if (row.bankAccountId === null) {
      return null;
    }
    const account = await this.prisma.customerBankAccount.findUnique({
      where: { id: row.bankAccountId },
    });
    if (
      account?.deletedAt !== null ||
      account.accountNameVerifiedAt === null ||
      account.bankCode === null
    ) {
      return null;
    }
    return {
      bankCode: account.bankCode,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
    };
  }

  public async initiate(id: string): Promise<void> {
    const row = await this.prisma.withdrawalRequest.findUnique({ where: { id } });
    if (row?.status !== WithdrawalRequestStatus.PENDING) return;
    const account = await this.destination(row);
    if (account === null) {
      await this.fail(id, 'Verified payout destination is no longer available');
      return;
    }
    const provider = this.providers.find((item) => item.provider === 'PAYSTACK');
    if (!provider) {
      await this.fail(id, 'Paystack payout provider is not configured');
      return;
    }

    try {
      const result = await provider.initiatePayout({
        reference: id,
        amount: Number(row.amount),
        currency: row.currency,
        bankCode: account.bankCode,
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        narration: 'DrippleX wallet payout',
      });
      if (result.status === 'SUCCESS')
        await this.succeed(id, result.providerTransferId ?? result.reference);
      if (result.status === 'FAILED') await this.fail(id, 'Provider rejected the transfer');
    } catch (error) {
      await this.fail(id, error instanceof Error ? error.message : 'Payout provider error');
    }
  }

  public async processProviderResult(
    reference: string,
    status: 'SUCCESS' | 'FAILED',
    providerReference?: string | null,
    reason?: string,
  ): Promise<void> {
    const row = await this.prisma.withdrawalRequest.findUnique({ where: { id: reference } });
    if (!row) return;
    if (status === 'SUCCESS') {
      if (row.status === WithdrawalRequestStatus.PENDING)
        await this.succeed(reference, providerReference ?? reference);
      return;
    }
    if (
      row.status === WithdrawalRequestStatus.COMPLETED ||
      row.status === WithdrawalRequestStatus.PENDING
    ) {
      await this.fail(reference, reason ?? 'Provider transfer failed or was reversed');
    }
  }

  private async succeed(id: string, providerReference: string): Promise<void> {
    await this.prisma.withdrawalRequest.updateMany({
      where: { id, status: WithdrawalRequestStatus.PENDING },
      data: {
        status: WithdrawalRequestStatus.COMPLETED,
        adminNote: `Provider transfer ${providerReference}`,
        processedAt: new Date(),
      },
    });
  }

  private async fail(id: string, reason: string): Promise<void> {
    const row = await this.prisma.withdrawalRequest.findUnique({ where: { id } });
    if (
      !row ||
      (row.status !== WithdrawalRequestStatus.PENDING &&
        row.status !== WithdrawalRequestStatus.COMPLETED)
    )
      return;
    const changed = await this.prisma.withdrawalRequest.updateMany({
      where: { id, status: row.status },
      data: {
        status: WithdrawalRequestStatus.FAILED,
        failureReason: reason.slice(0, 500),
        processedAt: new Date(),
      },
    });
    if (changed.count === 0) return;
    const wallet = await this.prisma.wallet.findUnique({ where: { id: row.walletId } });
    if (!wallet) return;
    await this.walletService.credit({
      ownerType: wallet.ownerType,
      ownerId: wallet.ownerId,
      amount: Number(row.amount),
      currency: row.currency,
      referenceType: WALLET_WITHDRAWAL_REVERSAL_REFERENCE_TYPE,
      referenceId: id,
      description: `Withdrawal reversed: ${reason}`,
    });
  }

  private stringField(event: DomainEvent, key: string): string | null {
    const value = event.payload[key];
    return typeof value === 'string' && value.length > 0 ? value : null;
  }
}
