import { randomUUID } from 'node:crypto';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { WalletOwnerType, OrderPaymentMethod } from '@prisma/client';

import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS, type DomainEvent } from '../events/domain-events';
import { PrismaService } from '../prisma/prisma.service';
import { PAYOUT_PROVIDERS, type PayoutProvider } from '../wallet/payout/payout-provider.adapter';
import { BANK_ACCOUNT_RESOLVER, type BankAccountResolver } from '../wallet/verification/bank-account-resolver.port';
import { WalletService } from '../wallet/wallet.service';

const MERCHANT_BANK_SETTLEMENT_REFERENCE = 'MERCHANT_BANK_SETTLEMENT';
type TransferStatus = 'SUCCESS' | 'FAILED';

@Injectable()
export class MerchantBankSettlementService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: DomainEventBus,
    private readonly walletService: WalletService,
    @Inject(PAYOUT_PROVIDERS) private readonly providers: PayoutProvider[],
    @Inject(BANK_ACCOUNT_RESOLVER) private readonly resolver: BankAccountResolver,
  ) {}

  public onModuleInit(): void { this.eventBus.on(DOMAIN_EVENTS.ORDER_COMPLETED, (event) => this.handleCompleted(event)); }

  private async handleCompleted(event: DomainEvent): Promise<void> {
    const orderId = this.stringField(event, 'orderId');
    if (!orderId) return;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (await this.settleOrder(orderId)) return;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  public async settleOrder(orderId: string): Promise<boolean> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.paymentMethod === OrderPaymentMethod.MERCHANT_DIRECT || order.paymentMethod === OrderPaymentMethod.CASH) return true;
    const settlement = await this.prisma.orderSettlement.findUnique({ where: { orderId } });
    if (!settlement) return false;
    if (settlement.status !== 'COMPLETED') return false;

    const profile = await this.prisma.merchantProfile.findUnique({ where: { id: settlement.merchantId }, select: { userId: true } });
    if (!profile) return true;
    const bank = await this.prisma.bankAccount.findFirst({ where: { merchantId: profile.userId, isDefault: true }, orderBy: { verifiedAt: 'desc' } });
    if (!bank || !bank.verifiedAt) return true;

    const bankName = bank.bankName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const bankOption = (await this.resolver.listBanks()).find((item) => item.name.toLowerCase().replace(/[^a-z0-9]/g, '') === bankName);
    if (!bankOption) return true;

    const existing = await this.prisma.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT id, status FROM merchant_settlement_transfers WHERE settlement_id = ${settlement.id}::uuid LIMIT 1
    `;
    if (existing[0]?.status === 'SUCCESS') return true;
    if (existing[0]?.status === 'PENDING') return false;

    const transferId = existing[0]?.id ?? randomUUID();
    if (!existing[0]) {
      await this.prisma.$executeRaw`
        INSERT INTO merchant_settlement_transfers
          (id, settlement_id, merchant_id, bank_account_id, amount, currency, provider, status)
        VALUES
          (${transferId}::uuid, ${settlement.id}::uuid, ${profile.userId}::uuid, ${bank.id}::uuid,
           ${Number(settlement.merchantAmount)}, ${settlement.currency}, 'PAYSTACK', 'PENDING')
      `;
    }

    const provider = this.providers.find((item) => String(item.provider) === 'PAYSTACK');
    if (!provider) { await this.markFailed(transferId, 'Paystack payout provider is not configured'); return true; }

    try {
      await this.walletService.withdrawal({
        ownerType: WalletOwnerType.MERCHANT,
        ownerId: profile.userId,
        amount: Number(settlement.merchantAmount),
        currency: settlement.currency,
        referenceType: MERCHANT_BANK_SETTLEMENT_REFERENCE,
        referenceId: transferId,
        description: `Bank settlement for order ${order.orderNumber}`,
      });

      const result = await provider.initiatePayout({
        reference: transferId,
        amount: Number(settlement.merchantAmount),
        currency: settlement.currency,
        bankCode: bankOption.code,
        accountNumber: bank.accountNumber,
        accountName: bank.accountName,
        narration: `DrippleX merchant settlement ${order.orderNumber}`,
      });
      if (result.status === 'SUCCESS') await this.markSuccess(transferId, result.providerTransferId ?? result.reference);
      if (result.status === 'FAILED') await this.markFailed(transferId, 'Provider rejected merchant settlement');
      return true;
    } catch (error) {
      await this.markFailed(transferId, error instanceof Error ? error.message : 'Merchant bank settlement failed');
      return true;
    }
  }

  public async processProviderResult(reference: string, status: TransferStatus, reason?: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string; merchant_id: string; amount: number; currency: string; status: string }>>`
      SELECT id, merchant_id, amount, currency, status FROM merchant_settlement_transfers WHERE id = ${reference}::uuid LIMIT 1
    `;
    const row = rows[0];
    if (!row) return;
    if (status === 'SUCCESS') {
      if (row.status === 'PENDING') await this.markSuccess(row.id, reference);
      return;
    }
    if (row.status === 'PENDING') {
      await this.markFailed(row.id, reason ?? 'Provider transfer failed');
      return;
    }
    if (row.status === 'SUCCESS') {
      const changed = await this.prisma.$executeRaw`
        UPDATE merchant_settlement_transfers SET status = 'REVERSED', failure_reason = ${reason ?? 'Provider transfer reversed'}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${row.id}::uuid AND status = 'SUCCESS'
      `;
      if (changed > 0) {
        await this.walletService.credit({
          ownerType: WalletOwnerType.MERCHANT,
          ownerId: row.merchant_id,
          amount: Number(row.amount),
          currency: row.currency,
          referenceType: `${MERCHANT_BANK_SETTLEMENT_REFERENCE}_REVERSAL`,
          referenceId: row.id,
          description: 'Merchant bank settlement reversed',
        });
      }
    }
  }

  private async markSuccess(id: string, providerReference: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE merchant_settlement_transfers SET status = 'SUCCESS', provider_reference = ${providerReference}, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}::uuid AND status = 'PENDING'
    `;
  }

  private async markFailed(id: string, reason: string): Promise<void> {
    const changed = await this.prisma.$executeRaw`
      UPDATE merchant_settlement_transfers SET status = 'FAILED', failure_reason = ${reason.slice(0, 500)}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}::uuid AND status = 'PENDING'
    `;
    if (changed === 0) return;
    const row = await this.prisma.$queryRaw<Array<{ merchant_id: string; amount: number; currency: string }>>`
      SELECT merchant_id, amount, currency FROM merchant_settlement_transfers WHERE id = ${id}::uuid LIMIT 1
    `;
    if (!row[0]) return;
    await this.walletService.credit({
      ownerType: WalletOwnerType.MERCHANT,
      ownerId: row[0].merchant_id,
      amount: Number(row[0].amount),
      currency: row[0].currency,
      referenceType: `${MERCHANT_BANK_SETTLEMENT_REFERENCE}_REVERSAL`,
      referenceId: id,
      description: `Merchant bank settlement failed: ${reason}`,
    });
  }

  private stringField(event: DomainEvent, key: string): string | null {
    const value = event.payload[key];
    return typeof value === 'string' && value.length > 0 ? value : null;
  }
}
