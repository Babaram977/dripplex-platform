import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { OrderSettlementStatus, OrderStatus, PaymentStatus, WalletOwnerType } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS, type DomainEvent } from '../events/domain-events';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

import { MerchantCommissionSettingsService } from './merchant-commission-settings.service';
import {
  ORDER_AUDIT_ACTIONS,
  ORDER_SETTLEMENT_REVERSAL_WALLET_REFERENCE_TYPE,
  ORDER_SETTLEMENT_WALLET_REFERENCE_TYPE,
} from './order.constants';

import type { OrderSettlement } from '@prisma/client';

/**
 * DPX-MERCHANT-002 — Marketplace Merchant Settlement. Subscribes to
 * ORDER_COMPLETED (the sole "successful fulfilment" signal, fired by
 * `OrderCompletionSweepService`) and credits the merchant's wallet via the
 * existing Wallet/Ledger architecture, exactly once per order. Also
 * subscribes to ORDER_REFUNDED to reverse an already-completed settlement.
 * See docs/DPX-MERCHANT-002-SETTLEMENT-DESIGN.md for the full design and
 * the reasoning behind every decision below.
 */
@Injectable()
export class MerchantSettlementService implements OnModuleInit {
  private readonly logger = new Logger(MerchantSettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly auditService: AuditService,
    private readonly commissionSettings: MerchantCommissionSettingsService,
    @Optional() private readonly eventBus?: DomainEventBus,
  ) {}

  public onModuleInit(): void {
    this.eventBus?.on(DOMAIN_EVENTS.ORDER_COMPLETED, (event) => this.handleOrderCompleted(event));
    this.eventBus?.on(DOMAIN_EVENTS.ORDER_REFUNDED, (event) => this.handleOrderRefunded(event));
  }

  public async handleOrderCompleted(event: DomainEvent): Promise<void> {
    const orderId = this.stringField(event, 'orderId');
    if (!orderId) {
      return;
    }
    try {
      await this.settleOrder(orderId);
    } catch (error) {
      this.logger.error(
        `Failed to settle order ${orderId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  public async handleOrderRefunded(event: DomainEvent): Promise<void> {
    const orderId = this.stringField(event, 'orderId');
    const reason = this.stringField(event, 'reason') ?? 'Order refunded';
    if (!orderId) {
      return;
    }
    try {
      await this.reverseSettlement(orderId, reason);
    } catch (error) {
      this.logger.error(
        `Failed to reverse settlement for order ${orderId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Settles a single order. Idempotent: `OrderSettlement.orderId` is a
   * unique constraint, so a replayed/concurrent call loses the race
   * harmlessly and returns the winner's row instead of creating a
   * duplicate or double-crediting the merchant's wallet.
   */
  public async settleOrder(orderId: string): Promise<OrderSettlement | null> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      this.logger.warn(`settleOrder: order ${orderId} not found`);
      return null;
    }
    // Defensive re-read, never trust the event payload for financial
    // decisions — ORDER_COMPLETED only fires once both are already true,
    // this guard is belt-and-braces, not an expected failure path.
    if (order.status !== OrderStatus.COMPLETED || order.paymentStatus !== PaymentStatus.PAID) {
      this.logger.warn(
        `settleOrder: order ${orderId} is not COMPLETED+PAID (status=${order.status}, paymentStatus=${order.paymentStatus}) — skipping`,
      );
      return null;
    }

    const setting = await this.commissionSettings.getEffective();
    const rate = Number(setting.commissionRate);
    const grossAmount = this.roundMoney(Number(order.subtotal));
    const commissionAmount = this.roundMoney(grossAmount * rate);
    const merchantAmount = this.roundMoney(grossAmount - commissionAmount);

    let settlement: OrderSettlement;
    let created: boolean;
    try {
      settlement = await this.prisma.orderSettlement.create({
        data: {
          orderId: order.id,
          merchantId: order.merchantId,
          status: OrderSettlementStatus.PENDING,
          grossAmount,
          commissionRate: rate,
          commissionAmount,
          merchantAmount,
          currency: order.currency,
        },
      });
      created = true;
    } catch (error) {
      if (!this.isUniqueConstraintViolation(error)) {
        throw error;
      }
      settlement = await this.prisma.orderSettlement.findUniqueOrThrow({ where: { orderId } });
      created = false;
    }

    if (!created || settlement.status !== OrderSettlementStatus.PENDING) {
      // Already settled (or already failed/reversed) by this or an
      // earlier call — nothing left to do.
      return settlement;
    }

    try {
      const merchantUserId = await this.resolveMerchantUserId(order.merchantId);
      await this.walletService.settlement({
        ownerType: WalletOwnerType.MERCHANT,
        ownerId: merchantUserId,
        amount: merchantAmount,
        currency: order.currency,
        referenceType: ORDER_SETTLEMENT_WALLET_REFERENCE_TYPE,
        referenceId: order.id,
        description: `Settlement for order ${order.orderNumber}`,
      });

      const wallet = await this.walletService.getWallet(
        WalletOwnerType.MERCHANT,
        merchantUserId,
        order.currency,
      );
      const ledgerEntry = await this.prisma.walletLedgerEntry.findFirst({
        where: {
          walletId: wallet.id,
          referenceType: ORDER_SETTLEMENT_WALLET_REFERENCE_TYPE,
          referenceId: order.id,
        },
        orderBy: { createdAt: 'desc' },
      });

      const completed = await this.prisma.orderSettlement.update({
        where: { id: settlement.id },
        data: {
          status: OrderSettlementStatus.COMPLETED,
          ...(ledgerEntry ? { walletLedgerEntryId: ledgerEntry.id } : {}),
        },
      });

      await this.auditService.record(
        ORDER_AUDIT_ACTIONS.SETTLEMENT_COMPLETED,
        {},
        {
          resource: 'order_settlement',
          resourceId: completed.id,
          metadata: {
            orderId: order.id,
            merchantId: order.merchantId,
            grossAmount,
            commissionRate: rate,
            commissionAmount,
            merchantAmount,
          },
        },
      );

      return completed;
    } catch (error) {
      const failureReason = error instanceof Error ? error.message : String(error);
      const failed = await this.prisma.orderSettlement.update({
        where: { id: settlement.id },
        data: { status: OrderSettlementStatus.FAILED, failureReason },
      });

      await this.auditService.record(
        ORDER_AUDIT_ACTIONS.SETTLEMENT_FAILED,
        {},
        {
          resource: 'order_settlement',
          resourceId: failed.id,
          metadata: { orderId: order.id, merchantId: order.merchantId, failureReason },
        },
      );

      throw error;
    }
  }

  /**
   * Reverses an already-COMPLETED settlement — the only after-the-fact
   * case, since a COMPLETED order cannot subsequently become CANCELLED
   * (no such transition exists in the Universal Order State Machine).
   * No-op if the order was never settled (nothing to reverse) or the
   * settlement is already REVERSED/FAILED.
   */
  public async reverseSettlement(orderId: string, reason: string): Promise<OrderSettlement | null> {
    const settlement = await this.prisma.orderSettlement.findUnique({ where: { orderId } });
    if (settlement?.status !== OrderSettlementStatus.COMPLETED) {
      return settlement;
    }

    const merchantUserId = await this.resolveMerchantUserId(settlement.merchantId);
    await this.walletService.debit({
      ownerType: WalletOwnerType.MERCHANT,
      ownerId: merchantUserId,
      amount: Number(settlement.merchantAmount),
      currency: settlement.currency,
      referenceType: ORDER_SETTLEMENT_REVERSAL_WALLET_REFERENCE_TYPE,
      referenceId: orderId,
      description: `Settlement reversal for order ${orderId}: ${reason}`,
    });

    const wallet = await this.walletService.getWallet(
      WalletOwnerType.MERCHANT,
      merchantUserId,
      settlement.currency,
    );
    const reversalLedgerEntry = await this.prisma.walletLedgerEntry.findFirst({
      where: {
        walletId: wallet.id,
        referenceType: ORDER_SETTLEMENT_REVERSAL_WALLET_REFERENCE_TYPE,
        referenceId: orderId,
      },
      orderBy: { createdAt: 'desc' },
    });

    const reversed = await this.prisma.orderSettlement.update({
      where: { id: settlement.id },
      data: {
        status: OrderSettlementStatus.REVERSED,
        reversedAt: new Date(),
        reversalReason: reason,
        ...(reversalLedgerEntry ? { reversalLedgerEntryId: reversalLedgerEntry.id } : {}),
      },
    });

    await this.auditService.record(
      ORDER_AUDIT_ACTIONS.SETTLEMENT_REVERSED,
      {},
      {
        resource: 'order_settlement',
        resourceId: reversed.id,
        metadata: {
          orderId,
          merchantId: settlement.merchantId,
          merchantAmount: Number(settlement.merchantAmount),
          reason,
        },
      },
    );

    return reversed;
  }

  /** `Order.merchantId` is `MerchantProfile.id`, but merchant `Wallet`
   * rows are keyed by `User.id` — see
   * docs/DPX-MERCHANT-002-SETTLEMENT-DESIGN.md §3. */
  private async resolveMerchantUserId(merchantProfileId: string): Promise<string> {
    const profile = await this.prisma.merchantProfile.findUniqueOrThrow({
      where: { id: merchantProfileId },
    });
    return profile.userId;
  }

  private stringField(event: DomainEvent, key: string): string | null {
    const value = event.payload[key];
    return typeof value === 'string' ? value : null;
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
  }

  private roundMoney(amount: number): number {
    return Math.round((amount + Number.EPSILON) * 100) / 100;
  }
}
