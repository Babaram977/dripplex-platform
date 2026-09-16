import type {
  OrderInvestigationStatus,
  OrderPaymentMethod,
  OrderRecovery,
  OrderRecoveryAction,
  OrderRecoveryActionOutcome,
  OrderRecoveryActionType,
  OrderRecoveryFinancialOutcome,
  OrderRecoveryStatus,
  OrderRecoveryTrigger,
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
    status: string;
    paymentStatus: PaymentStatus;
    paymentMethod: OrderPaymentMethod | null;
    fulfillmentType: string;
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
}

export const ORDER_RECOVERY_REPOSITORY = Symbol('ORDER_RECOVERY_REPOSITORY');
