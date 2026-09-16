import type {
  FulfillmentType,
  OrderInvestigationStatus,
  OrderPaymentMethod,
  OrderRecovery,
  OrderRecoveryAction,
  OrderRecoveryActionOutcome,
  OrderRecoveryActionType,
  OrderRecoveryFinancialOutcome,
  OrderRecoveryStatus,
  OrderRecoveryTrigger,
  OrderStatus,
  PaymentStatus,
} from '@prisma/client';

/**
 * DPX-ORDER-8D-RECOVERY Increment 1 — the recovery case store.
 *
 * READ AND CASE-FILE WRITES ONLY. Nothing on this interface cancels an order,
 * moves money, or touches Order, PaymentTransaction, Wallet or
 * WalletLedgerEntry. Those arrive in later increments, behind their own
 * rulings; Increment 1 deliberately cannot perform a recovery.
 */

/** The case with its timeline and enough of the order to triage it. */
export type OrderRecoveryWithDetail = OrderRecovery & {
  actions: OrderRecoveryAction[];
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    paymentMethod: OrderPaymentMethod | null;
    fulfillmentType: FulfillmentType;
    customerId: string;
    merchantId: string;
    total: unknown;
    currency: string;
    confirmedAt: Date | null;
    createdAt: Date;
  };
};

export interface OpenRecoveryInput {
  orderId: string;
  orderExceptionId?: string;
  trigger: OrderRecoveryTrigger;
  /** Null/absent means the platform acted rather than a person. */
  openedById?: string;
  paymentMethodAtOpen: OrderPaymentMethod | null;
  paymentStatusAtOpen: PaymentStatus;
  financialOutcome?: OrderRecoveryFinancialOutcome;
  investigationStatus?: OrderInvestigationStatus;
  predatesRecoveryImplementation?: boolean;
}

export interface RecordActionInput {
  recoveryId: string;
  type: OrderRecoveryActionType;
  outcome: OrderRecoveryActionOutcome;
  automatic: boolean;
  actorId?: string;
  paymentTransactionId?: string;
  walletLedgerEntryId?: string;
  supportTicketId?: string;
  orderPaymentProofId?: string;
  notificationId?: string;
  detail?: string;
}

export interface ListRecoveriesFilter {
  status?: OrderRecoveryStatus;
  trigger?: OrderRecoveryTrigger;
  predatesRecoveryImplementation?: boolean;
  skip: number;
  take: number;
}

export interface OrderRecoveryRepository {
  /**
   * Open a case, or report that one already exists.
   *
   * THIS IS THE CONCURRENCY CLAIM. `order_recoveries.order_id` is UNIQUE, so
   * exactly one caller can create the case for an order — a second sweep
   * worker, or an operator racing the backstop, gets `{ opened: false }` and
   * must abandon rather than proceed. Correctness rests on the database
   * constraint, not on this method remembering to check first: a read-then-write
   * would leave a window between the two.
   */
  openCase(input: OpenRecoveryInput): Promise<{ opened: boolean; recovery: OrderRecovery }>;

  findByOrderId(orderId: string): Promise<OrderRecoveryWithDetail | null>;
  findById(id: string): Promise<OrderRecoveryWithDetail | null>;
  list(filter: ListRecoveriesFilter): Promise<{ items: OrderRecoveryWithDetail[]; total: number }>;

  /** Append one step to the case timeline. Never mutates an existing action. */
  recordAction(input: RecordActionInput): Promise<OrderRecoveryAction>;

  /**
   * Resolve an order by its human-facing number, for recognising a case.
   *
   * Lives here rather than on OrdersRepository deliberately: adding a method
   * there would widen a shared interface every order service implements, for a
   * lookup only recovery needs. A read of four columns.
   */
  findOrderForRecognition(orderNumber: string): Promise<{
    id: string;
    paymentMethod: OrderPaymentMethod | null;
    paymentStatus: PaymentStatus;
  } | null>;

  /**
   * The order's CURRENT state, read immediately before a recovery mutation.
   *
   * Exists so the decision is never made from a row the caller fetched earlier:
   * a merchant can accept an order between an operator opening the queue and
   * pressing cancel. Returns whether a stalled exception is still open in the
   * same read, so the two facts cannot disagree.
   */
  findOrderStateForRecovery(orderId: string): Promise<{
    id: string;
    orderNumber: string;
    status: OrderStatus;
    paymentMethod: OrderPaymentMethod | null;
    paymentStatus: PaymentStatus;
    customerId: string;
    /** Prisma Decimal. Kept opaque here so the repository interface does not
     * drag a Decimal dependency into every consumer; the caller converts. */
    total: unknown;
    currency: string;
    hasOpenStalledException: boolean;
    openExceptionId: string | null;
  } | null>;

  updateCaseStatus(
    recoveryId: string,
    input: {
      status: OrderRecoveryStatus;
      financialOutcome?: OrderRecoveryFinancialOutcome;
      closedAt?: Date;
      closedById?: string;
    },
  ): Promise<void>;

  /**
   * Record that a wallet reversal returned money, and mark the payment refunded
   * in one statement.
   *
   * DPX-ORDER-8D-RECOVERY Increment 3. The order's STATUS is deliberately not
   * touched — it stays CANCELLED, because a refunded cancellation is still a
   * cancellation. Only `paymentStatus`/`refundedAt` move, and only after the
   * ledger has confirmed the credit.
   */
  markOrderRefunded(orderId: string): Promise<void>;

  /**
   * Orders the 24-hour automatic backstop may act on. Increment 4.
   *
   * EVERY CONDITION HERE IS A SAFETY CONDITION, and each is falsification-tested
   * individually. In one statement, so no two facts can be read at different
   * instants:
   *   • status is still CONFIRMED — the merchant never advanced it
   *   • a STALLED_CONFIRMED exception is still OPEN
   *   • that exception was detected AT OR AFTER the activation boundary — this
   *     is what keeps pre-activation orders, DPX-20260911-F7GK1S among them,
   *     structurally out of automatic recovery even when they carry no case
   *   • the order has been in CONFIRMED at least `backstopBefore`
   *   • no recovery case exists yet, or the one that exists is not historical
   *
   * Returning a row is not permission to act on it. The caller re-reads and
   * revalidates immediately before mutating, because this query and the
   * mutation are separated by everything the sweep does in between — the
   * select-then-mutate gap that OrderCompletionSweepService leaves open.
   */
  findBackstopEligibleOrders(input: {
    activationAt: Date;
    backstopBefore: Date;
    limit: number;
  }): Promise<{ id: string; orderNumber: string; exceptionId: string }[]>;
}

export const ORDER_RECOVERY_REPOSITORY = Symbol('ORDER_RECOVERY_REPOSITORY');
