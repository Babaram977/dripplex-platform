import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import {
  CommissionOwnerType,
  OrderPaymentMethod,
  OrderSettlementStatus,
  OrderStatus,
  PaymentStatus,
  WalletOwnerType,
} from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import {
  COMMISSION_AUTOMATIC_DEDUCTION_REFERENCE_TYPE,
  COMMISSION_ORDER_REVERSAL_REFERENCE_TYPE,
  COMMISSION_REFERENCE_TYPES,
} from '../commercial/commercial.constants';
import { CommissionAccountService } from '../commercial/commission-account.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
} from '../common/exceptions/domain.exception';
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
import { toOrderSettlementDto } from './order.mapper';

import type { OrderSettlementDto, PaginatedResult } from '@dripplex/types';
import type { Order, OrderSettlement } from '@prisma/client';

/// DPX-COMMERCIAL-001 Slice 2 §0.2 — the online/digitally-verified payment
/// methods automatic deduction applies to. CASH is deliberately excluded
/// — since Slice 3, it accrues commission the same way MERCHANT_DIRECT
/// does (see accruesCommission()), so it never reaches the wallet-credit
/// path this set gates at all.
const ONLINE_PAYMENT_METHODS: ReadonlySet<OrderPaymentMethod> = new Set([
  OrderPaymentMethod.WALLET,
  OrderPaymentMethod.PAYSTACK,
  OrderPaymentMethod.FLUTTERWAVE,
  OrderPaymentMethod.OPAY,
]);

/// DPX-COMMERCIAL-001 Slice 2/3 — the two payment methods where DrippleX
/// never held the sale proceeds (the merchant was paid directly, or paid
/// in cash by the customer at the door) and so settles by accruing the
/// commission owed onto the merchant's CommissionAccount instead of
/// crediting Wallet. See policy doc §3.3 (mode B) and §3.4 (mode C).
function accruesCommission(paymentMethod: OrderPaymentMethod | null): boolean {
  return (
    paymentMethod === OrderPaymentMethod.MERCHANT_DIRECT ||
    paymentMethod === OrderPaymentMethod.CASH
  );
}

/**
 * DPX-MERCHANT-002 — Marketplace Merchant Settlement. Subscribes to
 * ORDER_COMPLETED (the sole "successful fulfilment" signal, fired by
 * `OrderCompletionSweepService`), exactly once per order via
 * `OrderSettlement.orderId`'s unique constraint. For mode A (online
 * payment) settles by crediting the merchant's Wallet via the existing
 * Wallet/Ledger architecture; for mode B (Pay to Merchant) and mode C
 * (Cash on Delivery, since DPX-COMMERCIAL-001 Slice 3) DrippleX never
 * held the money, so it settles by accruing the commission owed onto the
 * merchant's CommissionAccount instead — see `accruesCommission()`. Also
 * subscribes to ORDER_REFUNDED to reverse an already-completed settlement.
 * See docs/DPX-MERCHANT-002-SETTLEMENT-DESIGN.md for the original design
 * and docs/DPX-COMMERCIAL-001-SLICE-3-COD-CORRECTION.md for the mode-C
 * settlement-direction fix.
 */
@Injectable()
export class MerchantSettlementService implements OnModuleInit {
  private readonly logger = new Logger(MerchantSettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly auditService: AuditService,
    private readonly commissionSettings: MerchantCommissionSettingsService,
    private readonly commissionAccounts: CommissionAccountService,
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
    //
    // MERCHANT_DIRECT (mode B) is the one exception to requiring PAID:
    // DrippleX never digitally verifies that payment (the customer paid
    // the merchant directly), so paymentStatus stays PENDING for the
    // order's entire lifecycle by design — see PaymentService.
    // selectMerchantDirect(). status === COMPLETED alone is the trigger
    // for mode B. See docs/DPX-COMMERCIAL-001-REVENUE-SETTLEMENT-CREDIT-POLICY.md §3.3.
    const isMerchantDirect = order.paymentMethod === OrderPaymentMethod.MERCHANT_DIRECT;
    if (
      order.status !== OrderStatus.COMPLETED ||
      (!isMerchantDirect && order.paymentStatus !== PaymentStatus.PAID)
    ) {
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

      if (accruesCommission(order.paymentMethod)) {
        // Mode B (MERCHANT_DIRECT) or mode C (CASH, since Slice 3) —
        // DrippleX never held this money; there is nothing to credit to
        // Wallet. The commission owed on the sale accrues onto the
        // merchant's CommissionAccount instead. Exactly-once via the same
        // (accountId, referenceType, referenceId) guard every other
        // commission mutation uses.
        const isCash = order.paymentMethod === OrderPaymentMethod.CASH;
        await this.accrueCommissionWithRetry({
          ownerType: CommissionOwnerType.MERCHANT,
          ownerId: merchantUserId,
          amount: commissionAmount,
          referenceType: COMMISSION_REFERENCE_TYPES.ORDER,
          referenceId: order.id,
          description: isCash
            ? `Commission owed for order ${order.orderNumber} (Cash on Delivery)`
            : `Commission owed for order ${order.orderNumber} (Pay to Merchant)`,
        });

        const completed = await this.prisma.orderSettlement.update({
          where: { id: settlement.id },
          data: { status: OrderSettlementStatus.COMPLETED },
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
              paymentMethod: order.paymentMethod,
              creditedVia: 'commission_account',
            },
          },
        );

        return completed;
      }

      // Mode A (online) only — the wallet-crediting path. CASH no longer
      // reaches here as of Slice 3 (it accrues above, same as mode B).
      // DPX-COMMERCIAL-001 §0.2 automatic deduction applies only to the
      // digitally-verified online methods in ONLINE_PAYMENT_METHODS.
      const netMerchantAmount =
        order.paymentMethod !== null && ONLINE_PAYMENT_METHODS.has(order.paymentMethod)
          ? await this.applyAutomaticDeduction(merchantUserId, merchantAmount, order)
          : merchantAmount;

      // An automatic deduction can legitimately consume the entire
      // theoretical merchantAmount (the capped-deduction case) — Wallet
      // rejects a zero-amount mutation outright, and correctly so, there
      // is nothing to credit. Skip the credit step entirely rather than
      // calling it with 0.
      let ledgerEntry: { id: string } | null = null;
      if (netMerchantAmount > 0) {
        await this.walletService.settlement({
          ownerType: WalletOwnerType.MERCHANT,
          ownerId: merchantUserId,
          amount: netMerchantAmount,
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
        ledgerEntry = await this.prisma.walletLedgerEntry.findFirst({
          where: {
            walletId: wallet.id,
            referenceType: ORDER_SETTLEMENT_WALLET_REFERENCE_TYPE,
            referenceId: order.id,
          },
          orderBy: { createdAt: 'desc' },
        });
      }

      const completed = await this.prisma.orderSettlement.update({
        where: { id: settlement.id },
        data: {
          status: OrderSettlementStatus.COMPLETED,
          // Reflects the amount actually credited (net of any automatic
          // deduction), not the theoretical pre-deduction figure — the
          // paired CommissionLedgerEntry (referenceType
          // COMMISSION_AUTOMATIC_DEDUCTION_REFERENCE_TYPE) is the durable
          // record of what was deducted and why.
          merchantAmount: netMerchantAmount,
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
            merchantAmount: netMerchantAmount,
            ...(netMerchantAmount !== merchantAmount
              ? { commercialDeduction: this.roundMoney(merchantAmount - netMerchantAmount) }
              : {}),
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
   *
   * Known gap (documented, not fixed here): for a mode-A order that had
   * an automatic commission deduction applied at settlement time, this
   * reverses only the Wallet credit — it does not re-credit the deducted
   * amount back onto the merchant's CommissionAccount. Reconciling a
   * three-way reversal (Wallet, commission balance, and whatever the
   * merchant may have paid down in the meantime) needs its own explicit
   * founder-scoped decision, out of Slice 2's mandate.
   */
  public async reverseSettlement(orderId: string, reason: string): Promise<OrderSettlement | null> {
    const settlement = await this.prisma.orderSettlement.findUnique({ where: { orderId } });
    if (settlement?.status !== OrderSettlementStatus.COMPLETED) {
      return settlement;
    }

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    const merchantUserId = await this.resolveMerchantUserId(settlement.merchantId);

    if (accruesCommission(order?.paymentMethod ?? null)) {
      // Mode B (MERCHANT_DIRECT) or mode C (CASH, since Slice 3) — no
      // Wallet credit ever happened, so there's nothing to debit back.
      // Reverse the commission accrual instead: the sale that produced it
      // no longer stands, so the commission owed on it shouldn't either.
      // Not capped at the current balance — see
      // CommissionAccountService.reverseAccrual()'s doc comment.
      await this.reverseAccrualWithRetry({
        ownerType: CommissionOwnerType.MERCHANT,
        ownerId: merchantUserId,
        amount: Number(settlement.commissionAmount),
        referenceType: COMMISSION_ORDER_REVERSAL_REFERENCE_TYPE,
        referenceId: orderId,
        description: `Commission accrual reversed for order ${orderId}: ${reason}`,
      });

      const reversed = await this.prisma.orderSettlement.update({
        where: { id: settlement.id },
        data: {
          status: OrderSettlementStatus.REVERSED,
          reversedAt: new Date(),
          reversalReason: reason,
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
            commissionAmount: Number(settlement.commissionAmount),
            paymentMethod: order?.paymentMethod ?? null,
            reversedVia: 'commission_account',
            reason,
          },
        },
      );

      return reversed;
    }

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

  /**
   * DPX-MERCHANT-007 — merchant-facing settlement history for the Wallet
   * screen. Read-only; no financial mutation happens here. Joins in the
   * real `orderNumber` so the merchant never has to look up a raw order
   * UUID to answer "why did I receive ₦9,000 instead of ₦10,000."
   */
  public async listSettlements(
    merchantUserId: string,
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<OrderSettlementDto>> {
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { userId: merchantUserId },
    });
    if (!profile) {
      throw new NotFoundDomainException('Merchant profile not found');
    }

    const where = { merchantId: profile.id };
    const [items, total] = await Promise.all([
      this.prisma.orderSettlement.findMany({
        where,
        include: { order: { select: { orderNumber: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.orderSettlement.count({ where }),
    ]);

    return {
      items: items.map((settlement) =>
        toOrderSettlementDto(settlement, settlement.order.orderNumber),
      ),
      meta: {
        page,
        limit: pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
      },
    };
  }

  /** DPX-COMMERCIAL-001 §0.2 — pays down the merchant's outstanding
   * commission balance from this mode-A settlement before crediting
   * Wallet, capped at whichever is smaller. Bounded-retry on
   * ConflictDomainException: two orders from the same merchant can
   * legitimately complete close enough together that their settlements'
   * CommissionAccount.recordPayment() calls race on the same optimistic-
   * concurrency version — re-reading the current balance and recomputing
   * the deduction each attempt (rather than failing the whole settlement)
   * is what actually preserves "exactly-once, no lost update" here, since
   * both settlements are individually valid and the race is only ever
   * over which one's deduction lands first. */
  private async applyAutomaticDeduction(
    merchantUserId: string,
    merchantAmount: number,
    order: Order,
  ): Promise<number> {
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const account = await this.commissionAccounts.getOrCreateAccount(
        CommissionOwnerType.MERCHANT,
        merchantUserId,
      );
      const outstanding = Number(account.outstandingBalance);
      if (outstanding <= 0) {
        return merchantAmount;
      }

      const deduction = this.roundMoney(Math.min(outstanding, merchantAmount));
      if (deduction <= 0) {
        return merchantAmount;
      }

      try {
        await this.commissionAccounts.recordPayment({
          ownerType: CommissionOwnerType.MERCHANT,
          ownerId: merchantUserId,
          amount: deduction,
          referenceType: COMMISSION_AUTOMATIC_DEDUCTION_REFERENCE_TYPE,
          referenceId: order.id,
          description: `Automatic deduction from settlement for order ${order.orderNumber}`,
        });
        return this.roundMoney(merchantAmount - deduction);
      } catch (error) {
        if (!(error instanceof ConflictDomainException) || attempt === maxAttempts) {
          throw error;
        }
        // Someone else's settlement won the race on this account's
        // version — loop, re-read the now-current balance, retry.
      }
    }
    // Unreachable (the loop always returns or throws), but keeps the
    // return type honest for TypeScript's control-flow analysis.
    return merchantAmount;
  }

  /** DPX-COMMERCIAL-001 Slice 3 — bounded retry on ConflictDomainException
   * for a plain accrual, same reasoning as applyAutomaticDeduction(): two
   * orders for the same merchant (mode B and/or mode C, now both routed
   * through this same accrual path) can complete close enough together
   * that their accrue() calls race on the same CommissionAccount's
   * optimistic-concurrency version. Found by this slice's own concurrency
   * test — the original single-attempt call let ConflictDomainException
   * propagate up through settleOrder()'s try/catch, marking the whole
   * settlement FAILED instead of retrying an ordinary same-merchant race.
   * Unlike a deduction, the accrual amount never depends on the current
   * balance, so a retry is simply "try again," no recomputation needed. */
  private async accrueCommissionWithRetry(
    input: Parameters<CommissionAccountService['accrue']>[0],
  ): Promise<void> {
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.commissionAccounts.accrue(input);
        return;
      } catch (error) {
        if (!(error instanceof ConflictDomainException) || attempt === maxAttempts) {
          throw error;
        }
        // Someone else's settlement won the race on this account's
        // version — loop and retry; accrue()'s own exactly-once guard
        // (referenceType/referenceId) makes a retried call safe even if
        // some earlier attempt's transaction partially raced.
      }
    }
  }

  /** Same bounded-retry reasoning as accrueCommissionWithRetry(), applied
   * to reverseAccrual() — a refund reversing a mode-B/mode-C settlement
   * can race against another order's accrual/deduction/reversal on the
   * same shared CommissionAccount just as easily as two accruals can. */
  private async reverseAccrualWithRetry(
    input: Parameters<CommissionAccountService['reverseAccrual']>[0],
  ): Promise<void> {
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.commissionAccounts.reverseAccrual(input);
        return;
      } catch (error) {
        if (!(error instanceof ConflictDomainException) || attempt === maxAttempts) {
          throw error;
        }
      }
    }
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
