import { Inject, Injectable, Optional } from '@nestjs/common';
import { OrderStatus, PaymentStatus, WalletOwnerType } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';
import {
  NOTIFICATION_SERVICE,
  type NotificationService,
} from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

import { ORDER_AUDIT_ACTIONS, ORDER_WALLET_REFERENCE_TYPE } from './order.constants';
import { toOrderDto, toPaginatedOrders } from './order.mapper';
import {
  ORDERS_REPOSITORY,
  type OrdersRepository,
  type OrderWithItems,
} from './repositories/orders.repository';

import type { MerchantOrderListQueryDto } from './dto/merchant-order.dto';
import type { OrderDto, PaginatedResult } from '@dripplex/types';

/** Merchant-facing order lifecycle actions — Accept/Reject/Ready/Delay/Cancel.
 * A merchant can only act on orders where merchantId matches; findByIdForMerchant
 * enforces that ownership check at the repository layer. */
@Injectable()
export class MerchantOrdersService {
  constructor(
    @Inject(ORDERS_REPOSITORY)
    private readonly ordersRepository: OrdersRepository,
    private readonly auditService: AuditService,
    @Inject(NOTIFICATION_SERVICE)
    private readonly notifications: NotificationService,
    private readonly walletService: WalletService,
    private readonly prisma: PrismaService,
    @Optional()
    private readonly eventBus?: DomainEventBus,
  ) {}

  public async listOrders(
    merchantId: string,
    query: MerchantOrderListQueryDto,
  ): Promise<PaginatedResult<OrderDto>> {
    const { items, total } = await this.ordersRepository.list({
      merchantId,
      ...(query.status ? { status: query.status } : {}),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    return toPaginatedOrders(items, total, query.page, query.pageSize);
  }

  public async getOrder(merchantId: string, orderId: string): Promise<OrderDto> {
    const order = await this.requireOrder(merchantId, orderId);
    return toOrderDto(order);
  }

  public async acceptOrder(
    merchantId: string,
    orderId: string,
    context: AuditContext,
    estimatedReadyAt?: string,
  ): Promise<OrderDto> {
    const order = await this.requireOrder(merchantId, orderId);
    if (order.status !== OrderStatus.CONFIRMED) {
      throw new ValidationDomainException('Only confirmed orders can be accepted');
    }

    await this.ordersRepository.transition(order.id, {
      status: OrderStatus.PREPARING,
      ...(estimatedReadyAt !== undefined ? { estimatedReadyAt: new Date(estimatedReadyAt) } : {}),
    });

    await this.auditService.record(
      ORDER_AUDIT_ACTIONS.ACCEPTED,
      { ...context, userId: merchantId },
      {
        resource: 'order',
        resourceId: order.id,
        metadata: { estimatedReadyAt: estimatedReadyAt ?? null },
      },
    );

    await this.eventBus?.emit(
      DOMAIN_EVENTS.ORDER_ACCEPTED,
      { orderId: order.id, customerId: order.customerId, merchantId },
      { actorUserId: merchantId },
    );

    await this.notifyCustomer(order, 'order_accepted');

    return await this.refreshed(order.id);
  }

  public async rejectOrder(
    merchantId: string,
    orderId: string,
    reason: string,
    context: AuditContext,
  ): Promise<OrderDto> {
    const order = await this.requireOrder(merchantId, orderId);
    if (order.status !== OrderStatus.CONFIRMED) {
      throw new ValidationDomainException('Only confirmed orders can be rejected');
    }

    const refunded = await this.refundIfPaid(order, context, merchantId);

    await this.ordersRepository.transition(order.id, {
      status: OrderStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelledBy: 'MERCHANT',
      cancellationReason: reason,
      ...(refunded ? { paymentStatus: PaymentStatus.REFUNDED } : {}),
    });

    await this.auditService.record(
      ORDER_AUDIT_ACTIONS.REJECTED,
      { ...context, userId: merchantId },
      { resource: 'order', resourceId: order.id, metadata: { reason } },
    );

    await this.eventBus?.emit(
      DOMAIN_EVENTS.ORDER_REJECTED,
      { orderId: order.id, customerId: order.customerId, merchantId, reason },
      { actorUserId: merchantId },
    );

    await this.notifyCustomer(order, 'order_rejected', reason);

    return await this.refreshed(order.id);
  }

  public async markReady(
    merchantId: string,
    orderId: string,
    context: AuditContext,
  ): Promise<OrderDto> {
    const order = await this.requireOrder(merchantId, orderId);
    if (order.status !== OrderStatus.PREPARING) {
      throw new ValidationDomainException('Only orders being prepared can be marked ready');
    }

    await this.ordersRepository.transition(order.id, {
      status: OrderStatus.READY,
      readyAt: new Date(),
    });

    await this.auditService.record(
      ORDER_AUDIT_ACTIONS.READY,
      { ...context, userId: merchantId },
      { resource: 'order', resourceId: order.id, metadata: {} },
    );

    await this.eventBus?.emit(
      DOMAIN_EVENTS.ORDER_READY,
      {
        orderId: order.id,
        customerId: order.customerId,
        merchantId,
        fulfillmentType: order.fulfillmentType,
      },
      { actorUserId: merchantId },
    );

    await this.notifyCustomer(order, 'order_ready');

    return await this.refreshed(order.id);
  }

  public async delayOrder(
    merchantId: string,
    orderId: string,
    estimatedReadyAt: string,
    reason: string | undefined,
    context: AuditContext,
  ): Promise<OrderDto> {
    const order = await this.requireOrder(merchantId, orderId);
    if (order.status !== OrderStatus.PREPARING) {
      throw new ValidationDomainException('Only orders being prepared can be delayed');
    }

    await this.ordersRepository.transition(order.id, {
      status: OrderStatus.PREPARING,
      estimatedReadyAt: new Date(estimatedReadyAt),
    });

    await this.auditService.record(
      ORDER_AUDIT_ACTIONS.DELAYED,
      { ...context, userId: merchantId },
      {
        resource: 'order',
        resourceId: order.id,
        metadata: { estimatedReadyAt, reason: reason ?? null },
      },
    );

    await this.eventBus?.emit(
      DOMAIN_EVENTS.ORDER_DELAYED,
      {
        orderId: order.id,
        customerId: order.customerId,
        merchantId,
        estimatedReadyAt,
        reason: reason ?? null,
      },
      { actorUserId: merchantId },
    );

    await this.notifyCustomer(order, 'order_delayed', reason);

    return await this.refreshed(order.id);
  }

  public async cancelOrder(
    merchantId: string,
    orderId: string,
    reason: string | undefined,
    context: AuditContext,
  ): Promise<OrderDto> {
    const order = await this.requireOrder(merchantId, orderId);
    const cancellableStatuses: OrderStatus[] = [
      OrderStatus.CONFIRMED,
      OrderStatus.PREPARING,
      OrderStatus.READY,
    ];
    if (!cancellableStatuses.includes(order.status)) {
      throw new ValidationDomainException('Order cannot be cancelled in its current status');
    }

    const refunded = await this.refundIfPaid(order, context, merchantId);

    await this.ordersRepository.transition(order.id, {
      status: OrderStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelledBy: 'MERCHANT',
      ...(reason !== undefined ? { cancellationReason: reason } : {}),
      ...(refunded ? { paymentStatus: PaymentStatus.REFUNDED } : {}),
    });

    await this.auditService.record(
      ORDER_AUDIT_ACTIONS.CANCELLED,
      { ...context, userId: merchantId },
      { resource: 'order', resourceId: order.id, metadata: { reason: reason ?? null } },
    );

    await this.eventBus?.emit(
      DOMAIN_EVENTS.ORDER_CANCELLED,
      { orderId: order.id, customerId: order.customerId, merchantId, reason: reason ?? null },
      { actorUserId: merchantId },
    );

    await this.notifyCustomer(order, 'order_cancelled', reason);

    return await this.refreshed(order.id);
  }

  private async refundIfPaid(
    order: OrderWithItems,
    context: AuditContext,
    merchantId: string,
  ): Promise<boolean> {
    if (order.paymentStatus !== PaymentStatus.PAID) {
      return false;
    }
    await this.walletService.refund({
      ownerType: WalletOwnerType.CUSTOMER,
      ownerId: order.customerId,
      amount: Number(order.total),
      referenceType: ORDER_WALLET_REFERENCE_TYPE,
      referenceId: order.id,
      description: `Refund for order ${order.orderNumber}`,
      context: { ...context, userId: merchantId },
    });
    return true;
  }

  private async requireOrder(merchantId: string, orderId: string): Promise<OrderWithItems> {
    const order = await this.ordersRepository.findByIdForMerchant(orderId, merchantId);
    if (!order) {
      throw new NotFoundDomainException('Order not found');
    }
    return order;
  }

  private async refreshed(orderId: string): Promise<OrderDto> {
    const order = await this.ordersRepository.findById(orderId);
    if (!order) {
      throw new NotFoundDomainException('Order not found after update');
    }
    return toOrderDto(order);
  }

  private async notifyCustomer(
    order: OrderWithItems,
    event:
      'order_accepted' | 'order_rejected' | 'order_ready' | 'order_delayed' | 'order_cancelled',
    reason?: string,
  ): Promise<void> {
    const customer = await this.prisma.user.findUnique({ where: { id: order.customerId } });
    if (!customer?.email) {
      return;
    }
    await this.notifications.notifyOrderLifecycle({
      email: customer.email,
      event,
      orderId: order.id,
      orderNumber: order.orderNumber,
      ...(reason !== undefined ? { reason } : {}),
    });
  }
}
