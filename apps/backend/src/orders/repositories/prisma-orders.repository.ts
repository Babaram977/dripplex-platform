import { Injectable } from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import type {
  CreateOrderInput,
  CreateReservationInput,
  ListOrdersFilter,
  OrdersRepository,
  OrderWithItems,
} from './orders.repository';
import type { InventoryReservation, Order } from '@prisma/client';

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
        status: OrderStatus.PENDING_PAYMENT,
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
      include: { items: true, reservations: true },
    });
  }

  public async findById(id: string): Promise<OrderWithItems | null> {
    return await this.prisma.order.findUnique({
      where: { id },
      include: { items: true, reservations: true },
    });
  }

  public async findByIdForCustomer(id: string, customerId: string): Promise<OrderWithItems | null> {
    return await this.prisma.order.findFirst({
      where: { id, customerId },
      include: { items: true, reservations: true },
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
        include: { items: true, reservations: true },
        skip: filter.skip,
        take: filter.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items, total };
  }

  public async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    return await this.prisma.order.update({
      where: { id },
      data: { status },
    });
  }

  public async cancelOrder(id: string): Promise<Order> {
    return await this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.CANCELLED,
      },
    });
  }

  public async markFailed(id: string): Promise<Order> {
    return await this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.FAILED,
        paymentStatus: PaymentStatus.FAILED,
      },
    });
  }

  public async markPaid(id: string): Promise<Order> {
    return await this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.PAID,
        paymentStatus: PaymentStatus.PAID,
      },
    });
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
        status: OrderStatus.PENDING_PAYMENT,
        paymentStatus: PaymentStatus.PENDING,
        reservations: {
          some: {
            releasedAt: null,
            expiresAt: { lte: now },
          },
        },
      },
      include: { items: true, reservations: true },
    });
  }
}
