import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  NotificationCategory,
  NotificationChannel,
  NotificationType,
  OrderInvestigationStatus,
  OrderPaymentMethod,
  OrderRecoveryActionOutcome,
  OrderRecoveryActionType,
  OrderRecoveryFinancialOutcome,
  OrderRecoveryStatus,
  OrderRecoveryTrigger,
  OrderStatus,
  PaymentStatus,
  WalletOwnerType,
} from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { NotificationCenterService } from '../notification-center/notification-center.service';
import { WalletService } from '../wallet/wallet.service';

import {
  AUTOMATIC_RECOVERY_CANCELLATION_REASON,
  ORDER_AUDIT_ACTIONS,
  ORDER_WALLET_REFERENCE_TYPE,
} from './order.constants';
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
    private readonly wallet: WalletService,
    private readonly notifications: NotificationCenterService,
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
   * Return a cancelled order's money to the customer's DX Wallet.
   *
   * ⚠️ THE FIRST CODE IN THIS PROGRAMME THAT MOVES MONEY.
   *
   * CANCEL-FIRST IS MANDATORY (founder ruling, 2026-09-16). This refuses an
   * order that is not already CANCELLED. Cancellation and reversal are two
   * separate operations on purpose: a reversal that fails must leave the order
   * cancelled and the case retryable, not roll a cancellation back.
   *
   * IDEMPOTENCY IS THE LEDGER'S, NOT THIS METHOD'S. The credit goes through the
   * existing ORDER_WALLET_REFERENCE_TYPE + order.id key — the same key the
   * merchant cancellation and admin refund paths already use — so those flows
   * and this one cannot together produce two credits, in either order. The
   * uniqueness lives on (walletId, referenceType, referenceId) in the database;
   * nothing here is trusted to remember.
   *
   * THE THREE OUTCOMES ARE NOT INTERCHANGEABLE:
   *   applied  → SUCCEEDED, ledger cited, customer told their money is back
   *   !applied → NO_OP, no ledger cited, customer told NOTHING (the credit was
   *              already there; we did not make it, and claiming otherwise
   *              would be a second refund message for one refund)
   *   throws   → FAILED, no ledger cited, case parked AWAITING_FINANCIAL_RETRY
   *
   * A CONFLICT IS NOT A FAILURE. Two operators reversing at once collide on the
   * wallet's optimistic version guard, and the loser retries into the replay
   * path and correctly reports NO_OP. Without the retry the loser would record
   * FAILED for a reversal that did in fact happen.
   */
  public async reverseWalletForRecovery(input: {
    orderId: string;
    /** Absent means the platform acted. Paired with `automatic` below, this is
     * the only place the human/automatic distinction survives — the order
     * records ADMIN either way. */
    operatorId?: string;
    automatic?: boolean;
    context?: AuditContext;
  }): Promise<OrderRecoveryWithDetail> {
    const automatic = input.automatic ?? false;
    const context = input.context ?? {};
    const actor = input.operatorId;
    if (automatic === (actor !== undefined)) {
      // Exactly one of the two must hold. A row claiming to be both automatic
      // and performed by a named person, or neither, is not a record anybody
      // can audit.
      throw new Error('A recovery reversal is either automatic or performed by an operator');
    }
    const order = await this.recoveries.findOrderStateForRecovery(input.orderId);
    if (!order) {
      throw new NotFoundDomainException('Order not found');
    }

    const existing = await this.recoveries.findByOrderId(order.id);
    if (!existing) {
      throw new ConflictDomainException(
        'Order has no recovery case; cancel it through recovery before reversing payment',
      );
    }
    if (existing.predatesRecoveryImplementation) {
      // Same ruling as cancellation: a historical case reaches a recovery
      // action only through an explicitly authorised path.
      throw new ConflictDomainException(
        'This recovery case predates the recovery implementation and needs explicit authorisation',
      );
    }

    // Cancel-first. Re-read immediately before the write, never trusted from
    // the caller's earlier fetch.
    if (order.status !== OrderStatus.CANCELLED) {
      throw new ConflictDomainException(
        'Order must be cancelled through recovery before its payment is reversed',
        { status: order.status },
      );
    }

    // DX WALLET ONLY. Gateway refunds have no integration in this codebase and
    // MERCHANT_DIRECT money never reached DrippleX — both are a human's
    // decision under their own increment, and neither is guessed at here.
    if (order.paymentMethod !== OrderPaymentMethod.WALLET) {
      throw new ValidationDomainException('Only DX Wallet payments can be reversed automatically', {
        paymentMethod: order.paymentMethod,
      });
    }
    if (
      order.paymentStatus !== PaymentStatus.PAID &&
      order.paymentStatus !== PaymentStatus.REFUNDED
    ) {
      // REFUNDED is allowed through so a retry after a partial failure can
      // still reach the ledger and settle the case truthfully as a replay.
      throw new ValidationDomainException('Order was never paid, so there is nothing to reverse', {
        paymentStatus: order.paymentStatus,
      });
    }

    const recoveryId = existing.id;
    const amount = Number(order.total);

    let outcome: { applied: boolean; ledgerId: string };
    try {
      outcome = await this.withConflictRetry(
        async () =>
          await this.wallet.refund({
            ownerType: WalletOwnerType.CUSTOMER,
            ownerId: order.customerId,
            amount,
            referenceType: ORDER_WALLET_REFERENCE_TYPE,
            referenceId: order.id,
            description: `Refund for order ${order.orderNumber}`,
            context: { ...context, ...(actor !== undefined ? { userId: actor } : {}) },
          }),
      );
    } catch (error) {
      await this.recoveries.recordAction({
        recoveryId,
        type: OrderRecoveryActionType.WALLET_REVERSAL,
        outcome: OrderRecoveryActionOutcome.FAILED,
        automatic,
        ...(actor !== undefined ? { actorId: actor } : {}),
        detail: error instanceof Error ? error.message.slice(0, 2000) : 'Wallet reversal failed',
      });
      await this.recoveries.updateCaseStatus(recoveryId, {
        status: OrderRecoveryStatus.AWAITING_FINANCIAL_RETRY,
        financialOutcome: OrderRecoveryFinancialOutcome.REVERSAL_FAILED,
      });
      this.logger.error(
        `Wallet reversal FAILED for order ${order.orderNumber}; order remains cancelled and the case is retryable`,
      );
      throw error;
    }

    await this.recoveries.recordAction({
      recoveryId,
      type: OrderRecoveryActionType.WALLET_REVERSAL,
      outcome: outcome.applied
        ? OrderRecoveryActionOutcome.SUCCEEDED
        : OrderRecoveryActionOutcome.NO_OP,
      automatic,
      ...(actor !== undefined ? { actorId: actor } : {}),
      // The CHECK constraint added in Increment 3 enforces exactly this pairing
      // at the database. Citing a ledger entry on a NO_OP would claim we made a
      // credit that was already there.
      ...(outcome.applied ? { walletLedgerEntryId: outcome.ledgerId } : {}),
      detail: outcome.applied
        ? `Reversed ${order.currency} ${amount.toFixed(2)} to the customer's DX Wallet`
        : `Ledger already held this reversal; no second credit was made`,
    });

    await this.auditService.record(
      ORDER_AUDIT_ACTIONS.REFUNDED,
      { ...context, ...(actor !== undefined ? { userId: actor } : {}) },
      {
        resource: 'order',
        resourceId: order.id,
        metadata: {
          recoveryId,
          amount,
          currency: order.currency,
          viaRecovery: true,
          automatic,
          // The distinction the founder asked to keep in the audit history:
          // both leave exactly one credit, but only one of them made it.
          applied: outcome.applied,
        },
      },
    );

    await this.recoveries.markOrderRefunded(order.id);

    await this.recoveries.updateCaseStatus(recoveryId, {
      status: OrderRecoveryStatus.CLOSED,
      financialOutcome: OrderRecoveryFinancialOutcome.REVERSAL_CONFIRMED,
    });

    if (outcome.applied) {
      await this.notifyCustomerRefunded({
        recoveryId,
        customerId: order.customerId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount,
        currency: order.currency,
        ledgerId: outcome.ledgerId,
      });
    }

    const detail = await this.recoveries.findByOrderId(order.id);
    if (!detail) {
      throw new Error('Recovery case vanished after wallet reversal');
    }
    return detail;
  }

  /**
   * Tell the customer their money is back — and only then.
   *
   * `ledgerId` is a REQUIRED parameter rather than an optional one, so this
   * cannot be called for a reversal that has no ledger entry behind it. That is
   * the application half of the founder's invariant; the database half is the
   * CHECK constraint on order_recovery_actions. A refund message is a financial
   * statement to a customer, and the platform should be unable to make one it
   * cannot evidence.
   */
  private async notifyCustomerRefunded(input: {
    recoveryId: string;
    customerId: string;
    orderId: string;
    orderNumber: string;
    amount: number;
    currency: string;
    ledgerId: string;
  }): Promise<void> {
    const result = await this.notifications.send({
      userId: input.customerId,
      category: NotificationCategory.MARKETPLACE,
      channel: NotificationChannel.IN_APP,
      type: NotificationType.REFUND,
      title: 'Refund issued',
      body: `Your order ${input.orderNumber} was cancelled and ${input.currency} ${input.amount.toFixed(2)} has been returned to your DX Wallet.`,
      payload: { orderId: input.orderId, orderNumber: input.orderNumber, amount: input.amount },
    });

    // A customer who has muted this channel is not a failure, and the money has
    // already moved either way. Record what actually happened rather than
    // asserting a message that was never sent.
    await this.recoveries.recordAction({
      recoveryId: input.recoveryId,
      type: OrderRecoveryActionType.NOTIFICATION_SENT,
      outcome:
        result.notification === null
          ? OrderRecoveryActionOutcome.NO_OP
          : OrderRecoveryActionOutcome.SUCCEEDED,
      automatic: true,
      ...(result.notification !== null ? { notificationId: result.notification.id } : {}),
      detail:
        result.notification === null
          ? `Refund notification not delivered: ${result.reason ?? 'unknown'}`
          : 'Customer told their money was returned',
    });
  }

  /**
   * Retry an optimistic-concurrency loss.
   *
   * The wallet guards its balance with a version check and throws
   * ConflictDomainException when it loses. Mirrors the retry
   * RidePaymentService already uses around the same wallet calls — a conflict
   * means somebody else moved first, and the retry either applies or correctly
   * discovers the replay.
   */
  private async withConflictRetry<T>(op: () => Promise<T>): Promise<T> {
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await op();
      } catch (error) {
        if (!(error instanceof ConflictDomainException) || attempt === maxAttempts) {
          throw error;
        }
      }
    }
    throw new ConflictDomainException('Wallet balance changed; retry operation');
  }

  /** Candidates for the automatic backstop. Selection only — never permission. */
  public async findBackstopEligible(input: {
    activationAt: Date;
    backstopBefore: Date;
    limit: number;
  }): Promise<{ id: string; orderNumber: string; exceptionId: string }[]> {
    return await this.recoveries.findBackstopEligibleOrders(input);
  }

  /**
   * Recover one stalled order on the platform's own authority.
   *
   * Deliberately built ON TOP of the operator paths rather than beside them:
   * cancellation and reversal go through the same claim, the same
   * revalidation, the same ledger key and the same notification gate an
   * operator uses. A second implementation would be a second set of bugs, and
   * the money-moving half would be the one that drifted.
   *
   * `acted: false` is the ordinary outcome, not an error — another replica
   * claimed the case, or the merchant accepted the order between selection and
   * here. That gap is why revalidation exists.
   *
   * ATTRIBUTION. Founder ruling: the order records cancelledBy = ADMIN for both
   * operator and automatic recovery, so the distinction cannot live there. It
   * lives on the case (trigger = AUTOMATIC, openedById null) and on each action
   * row (automatic = true, actorId null).
   */
  public async recoverAutomatically(input: {
    orderId: string;
  }): Promise<{ acted: boolean; reason?: string }> {
    const order = await this.recoveries.findOrderStateForRecovery(input.orderId);
    if (!order) {
      return { acted: false, reason: 'order_not_found' };
    }

    // Revalidate immediately before mutating. The selection query ran before
    // everything the sweep has done since.
    if (order.status !== OrderStatus.CONFIRMED || !order.hasOpenStalledException) {
      return { acted: false, reason: 'no_longer_stalled' };
    }

    const claim = await this.recoveries.openCase({
      orderId: order.id,
      ...(order.openExceptionId !== null ? { orderExceptionId: order.openExceptionId } : {}),
      trigger: OrderRecoveryTrigger.AUTOMATIC,
      paymentMethodAtOpen: order.paymentMethod,
      paymentStatusAtOpen: order.paymentStatus,
      financialOutcome: financialOutcomeFor(order.paymentMethod, order.paymentStatus),
      investigationStatus: investigationStatusFor(order.paymentMethod, order.paymentStatus),
    });

    if (!claim.opened) {
      // THE CONCURRENCY CLAIM DOING ITS JOB. Another replica, or an operator,
      // owns this case. Abandon — never proceed on a case we did not claim.
      return { acted: false, reason: 'already_claimed' };
    }

    const recoveryId = claim.recovery.id;

    await this.orders.transition(order.id, {
      status: OrderStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelledBy: 'ADMIN',
      cancellationReason: AUTOMATIC_RECOVERY_CANCELLATION_REASON,
    });

    await this.recoveries.recordAction({
      recoveryId,
      type: OrderRecoveryActionType.CANCEL_ORDER,
      outcome: OrderRecoveryActionOutcome.SUCCEEDED,
      // No actorId. A person did not do this, and the pair is the only place
      // that survives.
      automatic: true,
      detail: AUTOMATIC_RECOVERY_CANCELLATION_REASON,
    });

    await this.auditService.record(
      ORDER_AUDIT_ACTIONS.CANCELLED,
      {},
      {
        resource: 'order',
        resourceId: order.id,
        metadata: {
          reason: AUTOMATIC_RECOVERY_CANCELLATION_REASON,
          recoveryId,
          viaRecovery: true,
          automatic: true,
        },
      },
    );

    await this.recoveries.updateCaseStatus(recoveryId, {
      status: statusAfterCancellation(
        financialOutcomeFor(order.paymentMethod, order.paymentStatus),
        investigationStatusFor(order.paymentMethod, order.paymentStatus),
      ),
    });

    // THE PAYMENT-METHOD DECISION. Only DX Wallet money moves automatically.
    //
    // CASH stops here: nothing reached anyone, because cash is collected on
    // delivery and the delivery never happened.
    //
    // MERCHANT_DIRECT and gateway payments stop here too, with their
    // investigation left OPEN by statusAfterCancellation. There is no gateway
    // refund integration in this codebase and MERCHANT_DIRECT money never
    // reached DrippleX; inventing either would be speculative, and moving money
    // automatically for a payment the platform never saw would be worse.
    if (
      order.paymentMethod === OrderPaymentMethod.WALLET &&
      order.paymentStatus === PaymentStatus.PAID
    ) {
      await this.reverseWalletAutomatically(order.id, recoveryId);
    }

    return { acted: true };
  }

  /**
   * The automatic half of the wallet reversal.
   *
   * A failure here must NOT undo the cancellation. Founder ruling: the order
   * stays CANCELLED and the case stays financially retryable, because the money
   * step is separate from the order step by design. So this swallows the error
   * after recording it — the sweep already counted the order as recovered,
   * which it was.
   */
  private async reverseWalletAutomatically(orderId: string, recoveryId: string): Promise<void> {
    try {
      await this.reverseWalletForRecovery({ orderId, automatic: true });
    } catch (error) {
      this.logger.error(
        `Automatic wallet reversal failed for recovery ${recoveryId}; the order remains cancelled and the case is retryable: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
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
      // HISTORICAL, not OPERATOR. Increment 1 used OPERATOR here and that was a
      // defect: it claimed a person initiated the case while leaving
      // openedById null, which the schema documents as "the platform acted".
      // It also put historical recognitions into the operator queue's
      // ?trigger=OPERATOR filter. Founder ruling, 2026-09-16.
      trigger: OrderRecoveryTrigger.HISTORICAL,
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
