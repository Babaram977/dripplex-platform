import { Injectable } from '@nestjs/common';
import { OrderExceptionStatus, OrderExceptionType, PaymentStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import type {
  ListRecoveriesFilter,
  OpenRecoveryInput,
  OrderRecoveryRepository,
  OrderRecoveryWithDetail,
  RecordActionInput,
} from './order-recovery.repository';
import type {
  OrderPaymentMethod,
  OrderRecovery,
  OrderRecoveryAction,
  OrderRecoveryFinancialOutcome,
  OrderRecoveryStatus,
  OrderStatus,
} from '@prisma/client';

const PRISMA_UNIQUE_VIOLATION = 'P2002';

/** The order columns an operator needs to triage a case, and no more. */
const RECOVERY_ORDER_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  paymentStatus: true,
  paymentMethod: true,
  fulfillmentType: true,
  customerId: true,
  merchantId: true,
  total: true,
  currency: true,
  confirmedAt: true,
  createdAt: true,
} as const;

const RECOVERY_INCLUDE = {
  // Oldest step first — a case file reads forwards. `id` breaks ties so two
  // actions written in the same millisecond keep a stable order.
  actions: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  order: { select: RECOVERY_ORDER_SELECT },
} satisfies Prisma.OrderRecoveryInclude;

@Injectable()
export class PrismaOrderRecoveryRepository implements OrderRecoveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create the case, or report that someone else already owns it.
   *
   * The unique violation is the expected losing path, not an error: two sweep
   * workers, or an operator and the backstop, can legitimately arrive at the
   * same order together. Exactly one create succeeds and the loser abandons.
   *
   * Deliberately NOT a findFirst-then-create: that reintroduces the window the
   * constraint exists to close.
   */
  public async openCase(
    input: OpenRecoveryInput,
  ): Promise<{ opened: boolean; recovery: OrderRecovery }> {
    try {
      const recovery = await this.prisma.orderRecovery.create({
        data: {
          orderId: input.orderId,
          ...(input.orderExceptionId !== undefined
            ? { orderExceptionId: input.orderExceptionId }
            : {}),
          trigger: input.trigger,
          ...(input.openedById !== undefined ? { openedById: input.openedById } : {}),
          paymentMethodAtOpen: input.paymentMethodAtOpen,
          paymentStatusAtOpen: input.paymentStatusAtOpen,
          ...(input.financialOutcome !== undefined
            ? { financialOutcome: input.financialOutcome }
            : {}),
          ...(input.investigationStatus !== undefined
            ? { investigationStatus: input.investigationStatus }
            : {}),
          ...(input.predatesRecoveryImplementation !== undefined
            ? { predatesRecoveryImplementation: input.predatesRecoveryImplementation }
            : {}),
        },
      });
      return { opened: true, recovery };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_UNIQUE_VIOLATION
      ) {
        const existing = await this.prisma.orderRecovery.findUniqueOrThrow({
          where: { orderId: input.orderId },
        });
        return { opened: false, recovery: existing };
      }
      throw error;
    }
  }

  public async findByOrderId(orderId: string): Promise<OrderRecoveryWithDetail | null> {
    return await this.prisma.orderRecovery.findUnique({
      where: { orderId },
      include: RECOVERY_INCLUDE,
    });
  }

  public async findById(id: string): Promise<OrderRecoveryWithDetail | null> {
    return await this.prisma.orderRecovery.findUnique({
      where: { id },
      include: RECOVERY_INCLUDE,
    });
  }

  /**
   * Newest case first, `id` breaking ties — without the tiebreak two cases
   * sharing an `openedAt` can swap between pages and one is never seen, the
   * same defect the exception queue guards against.
   */
  public async list(
    filter: ListRecoveriesFilter,
  ): Promise<{ items: OrderRecoveryWithDetail[]; total: number }> {
    const where = {
      ...(filter.status !== undefined ? { status: filter.status } : {}),
      ...(filter.trigger !== undefined ? { trigger: filter.trigger } : {}),
      ...(filter.predatesRecoveryImplementation !== undefined
        ? { predatesRecoveryImplementation: filter.predatesRecoveryImplementation }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.orderRecovery.findMany({
        where,
        include: RECOVERY_INCLUDE,
        orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
        skip: filter.skip,
        take: filter.take,
      }),
      this.prisma.orderRecovery.count({ where }),
    ]);

    return { items, total };
  }

  public async findOrderForRecognition(orderNumber: string): Promise<{
    id: string;
    paymentMethod: OrderPaymentMethod | null;
    paymentStatus: PaymentStatus;
  } | null> {
    return await this.prisma.order.findUnique({
      where: { orderNumber },
      select: { id: true, paymentMethod: true, paymentStatus: true },
    });
  }

  public async findOrderStateForRecovery(orderId: string): Promise<{
    id: string;
    orderNumber: string;
    status: OrderStatus;
    paymentMethod: OrderPaymentMethod | null;
    paymentStatus: PaymentStatus;
    customerId: string;
    total: unknown;
    currency: string;
    hasOpenStalledException: boolean;
    openExceptionId: string | null;
  } | null> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentMethod: true,
        paymentStatus: true,
        // Increment 3 reads the money fields here too, in the SAME statement as
        // the status, so a reversal can never be sized from one instant and
        // authorised from another.
        customerId: true,
        total: true,
        currency: true,
        // Read in the same statement as the status, so the two cannot be
        // fetched at different instants and disagree.
        exceptions: {
          where: {
            type: OrderExceptionType.STALLED_CONFIRMED,
            status: OrderExceptionStatus.OPEN,
          },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!order) {
      return null;
    }
    const open = order.exceptions[0];
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      customerId: order.customerId,
      total: order.total,
      currency: order.currency,
      hasOpenStalledException: open !== undefined,
      openExceptionId: open?.id ?? null,
    };
  }

  public async updateCaseStatus(
    recoveryId: string,
    input: {
      status: OrderRecoveryStatus;
      financialOutcome?: OrderRecoveryFinancialOutcome;
      closedAt?: Date;
      closedById?: string;
    },
  ): Promise<void> {
    await this.prisma.orderRecovery.update({
      where: { id: recoveryId },
      data: {
        status: input.status,
        ...(input.financialOutcome !== undefined
          ? { financialOutcome: input.financialOutcome }
          : {}),
        ...(input.closedAt !== undefined ? { closedAt: input.closedAt } : {}),
        ...(input.closedById !== undefined ? { closedById: input.closedById } : {}),
      },
    });
  }

  public async markOrderRefunded(orderId: string): Promise<void> {
    // `status` is deliberately absent. The order stays CANCELLED; only its
    // payment truth moves. Writing REFUNDED into `status` would erase the fact
    // that this order was cancelled through recovery.
    await this.prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: PaymentStatus.REFUNDED, refundedAt: new Date() },
    });
  }

  public async recordAction(input: RecordActionInput): Promise<OrderRecoveryAction> {
    return await this.prisma.orderRecoveryAction.create({
      data: {
        recoveryId: input.recoveryId,
        type: input.type,
        outcome: input.outcome,
        automatic: input.automatic,
        ...(input.actorId !== undefined ? { actorId: input.actorId } : {}),
        ...(input.paymentTransactionId !== undefined
          ? { paymentTransactionId: input.paymentTransactionId }
          : {}),
        ...(input.walletLedgerEntryId !== undefined
          ? { walletLedgerEntryId: input.walletLedgerEntryId }
          : {}),
        ...(input.supportTicketId !== undefined ? { supportTicketId: input.supportTicketId } : {}),
        ...(input.orderPaymentProofId !== undefined
          ? { orderPaymentProofId: input.orderPaymentProofId }
          : {}),
        ...(input.notificationId !== undefined ? { notificationId: input.notificationId } : {}),
        ...(input.detail !== undefined ? { detail: input.detail } : {}),
      },
    });
  }
}
