import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  OrderInvestigationStatus,
  OrderPaymentMethod,
  OrderRecoveryActionOutcome,
  OrderRecoveryActionType,
  OrderRecoveryFinancialOutcome,
  OrderRecoveryTrigger,
  PaymentStatus,
} from '@prisma/client';

import {
  ORDER_RECOVERY_REPOSITORY,
  type OrderRecoveryRepository,
  type OrderRecoveryWithDetail,
} from './repositories/order-recovery.repository';

/**
 * DPX-ORDER-8D-RECOVERY Increment 1 — the recovery case file.
 *
 * ⚠️ THIS INCREMENT CANNOT PERFORM A RECOVERY, AND THAT IS DELIBERATE.
 *
 * There is no cancellation here, no wallet reversal, no notification, no sweep.
 * The founder rulings of 2026-09-16 authorise the OUTCOME of a recovery; the
 * safe implementation is staged so that money moves for the first time in
 * Increment 3, behind an operator, and automatically only in Increment 4. This
 * increment builds the record those steps will write to, and nothing else.
 *
 * Every method below either reads, or writes exclusively to the recovery case
 * tables. Order, PaymentTransaction, Wallet and WalletLedgerEntry are never
 * mutated from this file.
 */
@Injectable()
export class OrderRecoveryService {
  private readonly logger = new Logger(OrderRecoveryService.name);

  constructor(
    @Inject(ORDER_RECOVERY_REPOSITORY)
    private readonly recoveries: OrderRecoveryRepository,
  ) {}

  public async getByOrderId(orderId: string): Promise<OrderRecoveryWithDetail | null> {
    return await this.recoveries.findByOrderId(orderId);
  }

  /**
   * Record a stalled order that was already open before recovery existed.
   *
   * Founder ruling, 2026-09-16: the historical case is neither ignored nor
   * quietly swept up by the new machinery. It is recognised explicitly, flagged
   * as predating the implementation, and left for a governed decision.
   *
   * WHAT THIS DOES NOT DO — and must not, in this increment or any later one
   * without its own authorisation:
   *   • it does not cancel the order
   *   • it does not touch payment or wallet state
   *   • it does not resolve the OrderException
   *   • it does not make the case eligible for the 24-hour automatic backstop
   *
   * `predatesRecoveryImplementation = true` is what the eventual sweep will
   * exclude on, so a pre-existing case can only ever reach a recovery action
   * through an explicitly authorised path.
   *
   * DELIBERATELY HAS NO AUTOMATIC CALLER. Nothing invokes this on boot, on a
   * timer, or on deploy. Increment 1 therefore ships inert: deploying it writes
   * no recovery row anywhere. Invoking it is a separate, authorised step.
   *
   * Idempotent through the unique claim: calling it twice opens one case.
   */
  public async recognizeHistoricalCase(input: {
    orderNumber: string;
    note: string;
  }): Promise<{ opened: boolean; recovery: OrderRecoveryWithDetail }> {
    const order = await this.recoveries.findOrderForRecognition(input.orderNumber);
    if (!order) {
      throw new Error(`Order ${input.orderNumber} not found`);
    }

    const result = await this.recoveries.openCase({
      orderId: order.id,
      trigger: OrderRecoveryTrigger.OPERATOR,
      paymentMethodAtOpen: order.paymentMethod,
      paymentStatusAtOpen: order.paymentStatus,
      financialOutcome: financialOutcomeFor(order.paymentMethod, order.paymentStatus),
      investigationStatus: investigationStatusFor(order.paymentMethod, order.paymentStatus),
      predatesRecoveryImplementation: true,
    });

    if (result.opened) {
      // Automatic: no person decided to open this, the recognition step did.
      await this.recoveries.recordAction({
        recoveryId: result.recovery.id,
        type: OrderRecoveryActionType.FINDING_RECORDED,
        outcome: OrderRecoveryActionOutcome.SUCCEEDED,
        automatic: true,
        detail: input.note,
      });
      this.logger.log(
        `Recognised pre-existing recovery case for ${input.orderNumber} (no order or payment state changed)`,
      );
    }

    const detail = await this.recoveries.findByOrderId(order.id);
    if (!detail) {
      throw new Error(`Recovery case for ${input.orderNumber} vanished after creation`);
    }
    return { opened: result.opened, recovery: detail };
  }
}

/**
 * Which financial treatment the ruling prescribes, decided from the payment
 * METHOD first.
 *
 * Branching on paymentStatus alone is the trap: CASH and MERCHANT_DIRECT are
 * both PENDING and require opposite handling. For CASH, PENDING genuinely means
 * no money reached anyone, because cash is collected on delivery and the
 * delivery never happened. For MERCHANT_DIRECT, PENDING is permanent by design
 * — DrippleX never sees that payment — so the customer may well have paid the
 * merchant, and treating it as unpaid would be a false statement about
 * someone's money.
 */
export function financialOutcomeFor(
  method: OrderPaymentMethod | null,
  status: PaymentStatus,
): OrderRecoveryFinancialOutcome {
  if (method === OrderPaymentMethod.MERCHANT_DIRECT) {
    return OrderRecoveryFinancialOutcome.MANUAL_REQUIRED;
  }
  if (method === OrderPaymentMethod.CASH) {
    return OrderRecoveryFinancialOutcome.NONE_DUE;
  }
  if (status !== PaymentStatus.PAID) {
    return OrderRecoveryFinancialOutcome.NONE_DUE;
  }
  // Paid through DX Wallet: a reversal is possible, but only Increment 3 may
  // perform it, and only once the ledger confirms it moved money.
  if (method === OrderPaymentMethod.WALLET) {
    return OrderRecoveryFinancialOutcome.UNDETERMINED;
  }
  // Paid through an external gateway. There is no gateway refund integration
  // anywhere in this codebase, and this increment does not invent one: the
  // ruling sends these to a human via a provider investigation.
  return OrderRecoveryFinancialOutcome.MANUAL_REQUIRED;
}

/** Which cases need a human to establish what happened to the money. */
export function investigationStatusFor(
  method: OrderPaymentMethod | null,
  status: PaymentStatus,
): OrderInvestigationStatus {
  if (method === OrderPaymentMethod.MERCHANT_DIRECT) {
    return OrderInvestigationStatus.OPEN;
  }
  if (
    status === PaymentStatus.PAID &&
    method !== null &&
    method !== OrderPaymentMethod.WALLET &&
    method !== OrderPaymentMethod.CASH
  ) {
    return OrderInvestigationStatus.OPEN;
  }
  return OrderInvestigationStatus.NOT_REQUIRED;
}
