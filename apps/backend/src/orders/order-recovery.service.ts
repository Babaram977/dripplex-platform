import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  OrderInvestigationStatus,
  OrderPaymentMethod,
  OrderRecoveryActionOutcome,
  OrderRecoveryActionType,
  OrderRecoveryFinancialOutcome,
  OrderRecoveryStatus,
  OrderRecoveryTrigger,
  OrderStatus,
  PaymentStatus,
} from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
} from '../common/exceptions/domain.exception';

import { ORDER_AUDIT_ACTIONS } from './order.constants';
import { toOrderRecoveryDto } from './order.mapper';
import {
  ORDER_RECOVERY_REPOSITORY,
  type OrderRecoveryRepository,
  type OrderRecoveryWithDetail,
} from './repositories/order-recovery.repository';
import { ORDERS_REPOSITORY, type OrdersRepository } from './repositories/orders.repository';

import type { OrderRecoveryDto, PaginatedResult } from '@dripplex/types';

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
    @Inject(ORDERS_REPOSITORY)
    private readonly orders: OrdersRepository,
    private readonly auditService: AuditService,
  ) {}

  public async list(input: {
    page: number;
    pageSize: number;
    status?: OrderRecoveryStatus;
    trigger?: OrderRecoveryTrigger;
  }): Promise<PaginatedResult<OrderRecoveryDto>> {
    const { items, total } = await this.recoveries.list({
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.trigger !== undefined ? { trigger: input.trigger } : {}),
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    });
    return {
      items: items.map(toOrderRecoveryDto),
      meta: {
        page: input.page,
        limit: input.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize) || 1),
      },
    };
  }

  public async getByOrderId(orderId: string): Promise<OrderRecoveryWithDetail | null> {
    return await this.recoveries.findByOrderId(orderId);
  }

  /**
   * Cancel a stalled order, on an operator's authority.
   *
   * ⚠️ THE FIRST CODE IN THIS PROGRAMME THAT CHANGES AN ORDER. Increment 1
   * could only record; this can act. What it still cannot do — deliberately,
   * and each awaiting its own increment — is move money, open a gateway or
   * merchant-direct investigation, notify anybody, or run without a person
   * asking for it.
   *
   * REVALIDATION IS THE POINT, not a formality. Between an operator opening the
   * queue and pressing cancel, the merchant may have accepted the order. The
   * completion sweep's select-then-mutate pattern leaves exactly that window
   * open; this re-reads the order and its exception immediately before the
   * write and refuses if either has moved. Deciding from the row the caller
   * fetched earlier would cancel an order that is already being prepared.
   *
   * cancelledBy is ADMIN whoever acts — founder ruling, 2026-09-16. The order
   * therefore cannot record that a HUMAN did this, so the recovery action row
   * carries `automatic: false` and the operator's id, and that pair is the only
   * place the distinction survives.
   */
  public async cancelForRecovery(input: {
    orderId: string;
    operatorId: string;
    reason: string;
    context: AuditContext;
  }): Promise<OrderRecoveryWithDetail> {
    const order = await this.recoveries.findOrderStateForRecovery(input.orderId);
    if (!order) {
      throw new NotFoundDomainException('Order not found');
    }

    // Re-read, immediately before the write, rather than trusting what the
    // caller saw.
    if (order.status !== OrderStatus.CONFIRMED) {
      throw new ConflictDomainException(
        'Order is no longer stalled and cannot be cancelled through recovery',
        { status: order.status },
      );
    }
    if (!order.hasOpenStalledException) {
      throw new ConflictDomainException('Order has no open stalled exception');
    }

    // The claim. An operator racing another operator, or a later automatic
    // backstop, loses here rather than cancelling twice.
    const claim = await this.recoveries.openCase({
      orderId: order.id,
      ...(order.openExceptionId !== null ? { orderExceptionId: order.openExceptionId } : {}),
      trigger: OrderRecoveryTrigger.OPERATOR,
      openedById: input.operatorId,
      paymentMethodAtOpen: order.paymentMethod,
      paymentStatusAtOpen: order.paymentStatus,
      financialOutcome: financialOutcomeFor(order.paymentMethod, order.paymentStatus),
      investigationStatus: investigationStatusFor(order.paymentMethod, order.paymentStatus),
    });

    if (!claim.opened) {
      // A pre-existing case is not automatically a refusal: recognition opens a
      // case without doing anything to the order, so one can legitimately exist
      // while the order is still stalled and still cancellable.
      //
      // There is deliberately NO "has it already been cancelled?" check here.
      // It would be unreachable: a successful cancellation leaves the order
      // CANCELLED, so the status revalidation above refuses the second attempt
      // before execution ever arrives here. Mutation testing proved that —
      // deleting such a check reddened nothing, because nothing could reach it.
      // Duplicate protection is the revalidation, which AOR-006 and AOR-007
      // both exercise; a second, untestable guard would only look reassuring.
      const existing = await this.recoveries.findByOrderId(order.id);
      if (existing?.predatesRecoveryImplementation === true) {
        // Founder ruling: a case predating the implementation reaches a
        // recovery action only through an explicitly authorised path, never as
        // a side effect of an operator opening the queue.
        throw new ConflictDomainException(
          'This recovery case predates the recovery implementation and needs explicit authorisation',
        );
      }
    }

    const recoveryId = claim.recovery.id;

    await this.orders.transition(order.id, {
      status: OrderStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelledBy: 'ADMIN',
      cancellationReason: input.reason,
    });

    await this.recoveries.recordAction({
      recoveryId,
      type: OrderRecoveryActionType.CANCEL_ORDER,
      outcome: OrderRecoveryActionOutcome.SUCCEEDED,
      automatic: false,
      actorId: input.operatorId,
      detail: input.reason,
    });

    await this.auditService.record(
      ORDER_AUDIT_ACTIONS.CANCELLED,
      { ...input.context, userId: input.operatorId },
      {
        resource: 'order',
        resourceId: order.id,
        metadata: {
          reason: input.reason,
          recoveryId,
          // Recorded because cancelledBy cannot carry it.
          viaRecovery: true,
          automatic: false,
        },
      },
    );

    await this.recoveries.updateCaseStatus(recoveryId, {
      status: statusAfterCancellation(
        financialOutcomeFor(order.paymentMethod, order.paymentStatus),
        investigationStatusFor(order.paymentMethod, order.paymentStatus),
      ),
    });

    const detail = await this.recoveries.findByOrderId(order.id);
    if (!detail) {
      throw new Error('Recovery case vanished after cancellation');
    }
    return detail;
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

/**
 * Where a case sits once the order has been cancelled.
 *
 * A cancellation is not the end of a recovery. Money may still be owed back, or
 * a human may still have to establish what happened to a payment DrippleX never
 * saw — those cases stay open under a status that says which is outstanding.
 * Only a case with nothing left to settle closes here.
 */
export function statusAfterCancellation(
  financialOutcome: OrderRecoveryFinancialOutcome,
  investigationStatus: OrderInvestigationStatus,
): OrderRecoveryStatus {
  if (investigationStatus === OrderInvestigationStatus.OPEN) {
    return OrderRecoveryStatus.AWAITING_INVESTIGATION;
  }
  if (financialOutcome === OrderRecoveryFinancialOutcome.NONE_DUE) {
    return OrderRecoveryStatus.CLOSED;
  }
  // A wallet reversal is still owed, and only Increment 3 may perform it.
  return OrderRecoveryStatus.AWAITING_FINANCIAL_RETRY;
}
