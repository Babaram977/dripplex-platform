import { Injectable } from '@nestjs/common';
import {
  FulfillmentType,
  OrderExceptionStatus,
  OrderExceptionType,
  OrderStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import type {
  CreateDisputeInput,
  CreateOrderInput,
  CreateReservationInput,
  ListOrdersFilter,
  OrdersRepository,
  OrderTransitionInput,
  OrderWithItems,
  ResolveDisputeInput,
} from './orders.repository';
import type { InventoryReservation, Order, OrderDispute } from '@prisma/client';

const ORDER_INCLUDE = { items: true, reservations: true, disputes: true } as const;

/** Postgres unique-violation code, as Prisma surfaces it. */
const PRISMA_UNIQUE_VIOLATION = 'P2002';

@Injectable()
export class PrismaOrdersRepository implements OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async create(input: CreateOrderInput): Promise<OrderWithItems> {
    return await this.prisma.order.create({
      data: {
        customerId: input.customerId,
        merchantId: input.merchantId,
        cartId: input.cartId,
        orderNumber: input.orderNumber,
        fulfillmentType: input.fulfillmentType,
        subtotal: input.subtotal,
        discount: input.discount,
        tax: input.tax,
        deliveryFee: input.deliveryFee,
        total: input.total,
        currency: input.currency,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        ...(input.couponCode !== undefined ? { couponCode: input.couponCode } : {}),
        ...(input.deliveryAddressId !== undefined
          ? { deliveryAddressId: input.deliveryAddressId }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        items: {
          create: input.items.map((item) => ({
            productId: item.productId,
            merchantId: item.merchantId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
            snapshotName: item.snapshotName,
            ...(item.variantId !== undefined ? { variantId: item.variantId } : {}),
            ...(item.snapshotImage !== undefined ? { snapshotImage: item.snapshotImage } : {}),
            ...(item.snapshotSku !== undefined ? { snapshotSku: item.snapshotSku } : {}),
          })),
        },
      },
      include: ORDER_INCLUDE,
    });
  }

  public async findById(id: string): Promise<OrderWithItems | null> {
    return await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
  }

  public async findByIdForCustomer(id: string, customerId: string): Promise<OrderWithItems | null> {
    return await this.prisma.order.findFirst({
      where: { id, customerId },
      include: ORDER_INCLUDE,
    });
  }

  public async findByIdForMerchant(id: string, merchantId: string): Promise<OrderWithItems | null> {
    return await this.prisma.order.findFirst({
      where: { id, merchantId },
      include: ORDER_INCLUDE,
    });
  }

  public async list(filter: ListOrdersFilter): Promise<{ items: OrderWithItems[]; total: number }> {
    const where: Prisma.OrderWhereInput = {
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
      ...(filter.merchantId ? { merchantId: filter.merchantId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.paymentStatus ? { paymentStatus: filter.paymentStatus } : {}),
      ...(filter.createdFrom || filter.createdTo
        ? {
            createdAt: {
              ...(filter.createdFrom ? { gte: filter.createdFrom } : {}),
              ...(filter.createdTo ? { lte: filter.createdTo } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: ORDER_INCLUDE,
        skip: filter.skip,
        take: filter.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items, total };
  }

  public async transition(id: string, input: OrderTransitionInput): Promise<Order> {
    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: input.status,
        ...(input.paymentStatus !== undefined ? { paymentStatus: input.paymentStatus } : {}),
        ...(input.paymentMethod !== undefined ? { paymentMethod: input.paymentMethod } : {}),
        ...(input.estimatedReadyAt !== undefined
          ? { estimatedReadyAt: input.estimatedReadyAt }
          : {}),
        ...(input.confirmedAt !== undefined ? { confirmedAt: input.confirmedAt } : {}),
        ...(input.readyAt !== undefined ? { readyAt: input.readyAt } : {}),
        ...(input.deliveredAt !== undefined ? { deliveredAt: input.deliveredAt } : {}),
        ...(input.completedAt !== undefined ? { completedAt: input.completedAt } : {}),
        ...(input.cancelledAt !== undefined ? { cancelledAt: input.cancelledAt } : {}),
        ...(input.cancelledBy !== undefined ? { cancelledBy: input.cancelledBy } : {}),
        ...(input.cancellationReason !== undefined
          ? { cancellationReason: input.cancellationReason }
          : {}),
        ...(input.refundedAt !== undefined ? { refundedAt: input.refundedAt } : {}),
      },
    });

    // DPX-ORDER-8D-C — an order that has left CONFIRMED is no longer stalled,
    // so any open exception on it closes here.
    //
    // Resolution is OBSERVED, not decided: this reacts to a status the order
    // reached by some other means, and changes nothing about the order itself.
    // It lives in `transition` for the same reason ORDER_ACTIONABLE lives in
    // finalizeOrderConfirmation — every status change in the system passes
    // through this one method, so no future path can advance an order and leave
    // a stale exception behind claiming it is still stalled.
    //
    // Guarded on the target status rather than the previous one: a transition
    // that keeps the order CONFIRMED (markCashPaymentReceived flips only
    // paymentStatus, passing status through unchanged) must not close it.
    if (input.status !== OrderStatus.CONFIRMED) {
      await this.resolveOpenExceptions(id, input.status);
    }

    return updated;
  }

  public async findByCartId(cartId: string): Promise<Order | null> {
    return await this.prisma.order.findFirst({
      where: { cartId },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async createReservations(
    inputs: CreateReservationInput[],
  ): Promise<InventoryReservation[]> {
    if (inputs.length === 0) {
      return [];
    }

    await this.prisma.inventoryReservation.createMany({
      data: inputs.map((input) => ({
        orderId: input.orderId,
        productId: input.productId,
        quantity: input.quantity,
        expiresAt: input.expiresAt,
        ...(input.variantId !== undefined ? { variantId: input.variantId } : {}),
      })),
    });

    return await this.prisma.inventoryReservation.findMany({
      where: {
        orderId: { in: [...new Set(inputs.map((row) => row.orderId))] },
        releasedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async releaseReservationsForOrder(orderId: string): Promise<number> {
    const result = await this.prisma.inventoryReservation.updateMany({
      where: { orderId, releasedAt: null },
      data: { releasedAt: new Date() },
    });
    return result.count;
  }

  public async findExpiredActiveReservations(now: Date): Promise<InventoryReservation[]> {
    return await this.prisma.inventoryReservation.findMany({
      where: {
        releasedAt: null,
        expiresAt: { lte: now },
      },
    });
  }

  public async findUnpaidOrdersWithExpiredReservations(now: Date): Promise<OrderWithItems[]> {
    return await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        reservations: {
          some: {
            releasedAt: null,
            expiresAt: { lte: now },
          },
        },
      },
      include: ORDER_INCLUDE,
    });
  }

  public async findAutoCompletableOrders(before: Date): Promise<OrderWithItems[]> {
    return await this.prisma.order.findMany({
      where: {
        status: OrderStatus.DELIVERED,
        deliveredAt: { lte: before },
      },
      include: ORDER_INCLUDE,
    });
  }

  public async findStalledConfirmedOrders(before: Date): Promise<OrderWithItems[]> {
    return await this.prisma.order.findMany({
      where: {
        status: OrderStatus.CONFIRMED,
        fulfillmentType: FulfillmentType.DELIVERY,
        // The age anchor is time spent IN CONFIRMED, not time since checkout.
        // confirmedAt is written in the same transaction that sets the status
        // and is the only path into it, so it should always be present; the
        // OR on createdAt is defence, because a null would otherwise silently
        // exclude the order rather than surface it.
        OR: [{ confirmedAt: { lte: before } }, { confirmedAt: null, createdAt: { lte: before } }],
        exceptions: {
          none: {
            type: OrderExceptionType.STALLED_CONFIRMED,
            status: OrderExceptionStatus.OPEN,
          },
        },
      },
      include: ORDER_INCLUDE,
    });
  }

  public async raiseStalledException(input: {
    orderId: string;
    waitedMinutes: number;
    detectedAt: Date;
  }): Promise<{ raised: boolean }> {
    try {
      await this.prisma.orderException.create({
        data: {
          orderId: input.orderId,
          type: OrderExceptionType.STALLED_CONFIRMED,
          status: OrderExceptionStatus.OPEN,
          detectedAt: input.detectedAt,
          waitedMinutes: input.waitedMinutes,
        },
      });
      return { raised: true };
    } catch (error) {
      // P2002 = the unique constraint fired, so an exception of this type
      // already exists for this order. That is the idempotency guarantee doing
      // its job, not a failure: two sweeps racing, or a RESOLVED row still
      // holding the (orderId, type) pair. Either way nothing new is raised and
      // nobody is notified twice.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_UNIQUE_VIOLATION
      ) {
        return { raised: false };
      }
      throw error;
    }
  }

  public async resolveOpenExceptions(
    orderId: string,
    resolvedStatus: OrderStatus,
  ): Promise<number> {
    const result = await this.prisma.orderException.updateMany({
      where: { orderId, status: OrderExceptionStatus.OPEN },
      data: {
        status: OrderExceptionStatus.RESOLVED,
        resolvedAt: new Date(),
        resolvedStatus,
      },
    });
    return result.count;
  }

  public async createDispute(input: CreateDisputeInput): Promise<OrderDispute> {
    return await this.prisma.orderDispute.create({
      data: {
        orderId: input.orderId,
        raisedBy: input.raisedBy,
        reason: input.reason,
      },
    });
  }

  public async findDisputeById(id: string): Promise<OrderDispute | null> {
    return await this.prisma.orderDispute.findUnique({ where: { id } });
  }

  public async findOpenDisputeForOrder(orderId: string): Promise<OrderDispute | null> {
    return await this.prisma.orderDispute.findFirst({
      where: { orderId, status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async resolveDispute(id: string, input: ResolveDisputeInput): Promise<OrderDispute> {
    return await this.prisma.orderDispute.update({
      where: { id },
      data: {
        status: input.status,
        resolution: input.resolution,
        resolvedBy: input.resolvedBy,
        resolvedAt: new Date(),
      },
    });
  }
}
