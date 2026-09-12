import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';

import { AuditService, type AuditContext } from '../../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../../common/exceptions/domain.exception';
import { MerchantOrdersService } from '../../orders/merchant-orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CONFLICT_TYPE } from '../catalogue-ingestion.constants';
import {
  MAX_POS_ORDER_PAGE_SIZE,
  ORDER_RECONCILIATION_STATUS,
  ORDER_SYNC_AUDIT_ACTIONS,
  POS_DRIVABLE_ORDER_STATUS,
  POS_DRIVABLE_ORDER_STATUSES,
  type PosDrivableOrderStatus,
} from '../order-sync.constants';

import { MerchantProfileResolver } from './merchant-profile-resolver.service';

import type { UpdateOrderStatusDto } from '../dtos/update-order-status.dto';
import type { MerchantIntegration, OrderStatusUpdate } from '@prisma/client';

/**
 * What a POS is allowed to see about an order.
 *
 * An allow-list, not an omit-list. The order row and its relations carry the
 * customer's identity, their delivery address, the driver, the ride and every
 * payment transaction; a third-party POS needs none of it to cook and hand over
 * food. Written as "these fields go out" so that a field added to `Order`
 * tomorrow is invisible here by default rather than exposed by default.
 */
export interface PosOrderView {
  orderNumber: string;
  status: string;
  /** PAID / PENDING / … — whether to hand the goods over. No method, no transactions. */
  paymentStatus: string;
  fulfillmentType: string;
  currency: string;
  subtotal: string;
  discount: string;
  tax: string;
  deliveryFee: string;
  total: string;
  /** The customer's instruction to the kitchen. */
  notes: string | null;
  placedAt: Date;
  estimatedReadyAt: Date | null;
  readyAt: Date | null;
  items: PosOrderItemView[];
}

export interface PosOrderItemView {
  name: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  /** This integration's own SKU for the product, when it has catalogued it. */
  externalSku: string | null;
}

export interface OrderStatusSyncResult {
  orderNumber: string;
  externalOrderId: string;
  previousStatus: string;
  newStatus: string;
  /** True when this idempotency key had already been used; nothing was re-run. */
  replayed: boolean;
  /** True when the order was already in the requested status, so nothing moved. */
  alreadyInStatus: boolean;
}

export interface PosOrderPage {
  items: PosOrderView[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * POS-driven order status synchronisation (MKT-INT-001-L, inbound half).
 *
 * The transition itself is **not** performed here. `MerchantOrdersService` owns
 * the order lifecycle — its preconditions, its customer notifications, its
 * domain events and, for the transitions a POS may not request, its wallet
 * refunds. This service authenticates the request against an integration,
 * resolves which DrippleX order is meant, enforces idempotency, and then calls
 * the same method the merchant's own portal button calls.
 *
 * That boundary is the whole design. A second order state machine living in the
 * integrations module would be a second opinion about when a customer gets
 * their money back.
 */
@Injectable()
export class OrderStatusIngestionService {
  private readonly logger = new Logger(OrderStatusIngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantProfiles: MerchantProfileResolver,
    private readonly merchantOrders: MerchantOrdersService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Apply one POS-reported status change.
   *
   * @param orderNumber the DrippleX order number, from the path — the only
   *   identifier both systems share today. There is no external-order-id
   *   mapping table, and resolving on an opaque POS string would be inventing
   *   one.
   */
  public async applyStatus(
    integration: MerchantIntegration,
    orderNumber: string,
    dto: UpdateOrderStatusDto,
    idempotencyKey: string,
  ): Promise<OrderStatusSyncResult> {
    // Checked here, before anything is written, and not only by the DTO. The
    // DTO's @IsIn is the request's validation; this is the service's own, so a
    // caller that reaches this method by any other route — a future internal
    // caller, a test, a controller wired up wrong — still cannot ask for a
    // transition a POS may not drive. `CANCELLED` refunds a customer.
    if (!POS_DRIVABLE_ORDER_STATUSES.includes(dto.status)) {
      throw new ValidationDomainException(`${dto.status} is not a transition a POS may drive`);
    }

    const merchantProfileId = await this.resolveMerchantProfile(integration);
    const order = await this.requireOwnedOrder(integration, merchantProfileId, orderNumber);

    const claim = await this.claim(integration, order, dto, idempotencyKey);
    if (claim.replayed) {
      return this.fromRecord(claim.record, orderNumber);
    }

    // Already there. A POS retrying after a timeout, or a merchant who tapped
    // the portal button first — either way the state the POS is asking for is
    // the state the order is in, so reporting a conflict would be inventing a
    // disagreement that does not exist. This is also what makes an interrupted
    // claim recoverable: a replay finds the row, and a fresh key finds the
    // order already moved.
    if (order.status === dto.status) {
      await this.settle(claim.record.id, ORDER_RECONCILIATION_STATUS.ACCEPTED);
      await this.recordAudit(integration, order.id, orderNumber, dto, true);
      return {
        orderNumber,
        externalOrderId: dto.externalOrderId,
        previousStatus: order.status,
        newStatus: dto.status,
        replayed: false,
        alreadyInStatus: true,
      };
    }

    try {
      await this.transition(integration, order.id, dto.status);
    } catch (error) {
      if (error instanceof ValidationDomainException) {
        // The order's current status does not allow what the POS asked for.
        // Recorded as a conflict the merchant can see rather than swallowed:
        // a till stuck reporting READY on an unconfirmed order is a real
        // operational problem, not a transient error.
        await this.settle(claim.record.id, ORDER_RECONCILIATION_STATUS.CONFLICT);
        await this.raiseStateMismatch(integration.id, order, dto);
        throw new ConflictDomainException(
          `Order ${orderNumber} is ${order.status} and cannot move to ${dto.status}`,
          { orderNumber, currentStatus: order.status, requestedStatus: dto.status },
        );
      }
      // Left PENDING on purpose. CONFLICT would claim we know the transition
      // was refused; PENDING says what is true — the key was claimed and the
      // outcome is unknown.
      this.logger.error(
        `Order status sync failed for ${orderNumber} on integration ${integration.id}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }

    await this.settle(claim.record.id, ORDER_RECONCILIATION_STATUS.ACCEPTED);
    await this.recordAudit(integration, order.id, orderNumber, dto, false);

    return {
      orderNumber,
      externalOrderId: dto.externalOrderId,
      previousStatus: order.status,
      newStatus: dto.status,
      replayed: false,
      alreadyInStatus: false,
    };
  }

  /** One order, as much of it as a POS may see. */
  public async getOrder(
    integration: MerchantIntegration,
    orderNumber: string,
  ): Promise<PosOrderView> {
    const merchantProfileId = await this.resolveMerchantProfile(integration);
    const order = await this.requireOwnedOrder(integration, merchantProfileId, orderNumber);
    const [view] = await this.toViews(integration.id, [order]);
    if (!view) {
      throw new NotFoundDomainException('Order not found');
    }
    return view;
  }

  /** This merchant's orders, newest first, one page at a time. */
  public async listOrders(
    integration: MerchantIntegration,
    page: number,
    pageSize: number,
  ): Promise<PosOrderPage> {
    const merchantProfileId = await this.resolveMerchantProfile(integration);
    const take = Math.min(Math.max(pageSize, 1), MAX_POS_ORDER_PAGE_SIZE);
    const skip = (Math.max(page, 1) - 1) * take;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { merchantId: merchantProfileId },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.order.count({ where: { merchantId: merchantProfileId } }),
    ]);

    return {
      items: await this.toViews(integration.id, orders),
      total,
      page: Math.max(page, 1),
      pageSize: take,
    };
  }

  private async resolveMerchantProfile(integration: MerchantIntegration): Promise<string> {
    const merchantProfileId = await this.merchantProfiles.resolve(integration.merchantId);
    if (!merchantProfileId) {
      // A DrippleX-side defect, not a bad request: this integration is linked
      // to a user with no merchant profile, so it owns no orders at all.
      this.logger.error(
        `Integration ${integration.id} has no merchant profile for user ${integration.merchantId}`,
      );
      throw new InternalServerErrorException('Integration is not linked to a merchant profile');
    }
    return merchantProfileId;
  }

  /**
   * Resolve the order, and prove it is this integration's merchant's.
   *
   * A missing order and another merchant's order answer identically. Telling
   * the two apart would let anyone holding one integration's key enumerate
   * which order numbers exist across the platform.
   */
  private async requireOwnedOrder(
    integration: MerchantIntegration,
    merchantProfileId: string,
    orderNumber: string,
  ): Promise<Prisma.OrderGetPayload<{ include: { items: true } }>> {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber, merchantId: merchantProfileId },
      include: { items: true },
    });

    if (!order) {
      // Logged, not recorded as an OrderStatusUpdate: a row keyed on a
      // caller-supplied idempotency key for an order that does not exist would
      // let a POS write into the reconciliation table at will.
      await this.log(integration.id, orderNumber, 'ORDER_NOT_FOUND');
      throw new NotFoundDomainException('Order not found');
    }
    return order;
  }

  /**
   * Take the idempotency key, or discover somebody already has.
   *
   * The unique index on `(integrationId, idempotencyKey)` is the guarantee. The
   * insert is the claim: whoever lands it owns the transition, and the loser
   * reads back what the winner recorded instead of running the transition a
   * second time.
   */
  private async claim(
    integration: MerchantIntegration,
    order: { id: string; status: OrderStatus },
    dto: UpdateOrderStatusDto,
    idempotencyKey: string,
  ): Promise<{ record: OrderStatusUpdate; replayed: boolean }> {
    try {
      const record = await this.prisma.orderStatusUpdate.create({
        data: {
          integrationId: integration.id,
          externalOrderId: dto.externalOrderId,
          internalOrderId: order.id,
          previousStatus: order.status,
          newStatus: dto.status,
          sourceTimestamp: dto.sourceTimestamp ? new Date(dto.sourceTimestamp) : new Date(),
          reconciliationStatus: ORDER_RECONCILIATION_STATUS.PENDING,
          idempotencyKey,
        },
      });
      return { record, replayed: false };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.orderStatusUpdate.findUnique({
          where: {
            integrationId_idempotencyKey: { integrationId: integration.id, idempotencyKey },
          },
        });
        if (existing) {
          return { record: existing, replayed: true };
        }
      }
      throw error;
    }
  }

  /**
   * Answer a replay with what the first attempt recorded.
   *
   * Never re-runs. A recorded conflict is re-raised as the same 409, because
   * one idempotency key means one outcome; a POS that wants another attempt
   * sends another key, and the order's own preconditions make that safe.
   */
  private fromRecord(record: OrderStatusUpdate, orderNumber: string): OrderStatusSyncResult {
    if (record.reconciliationStatus === ORDER_RECONCILIATION_STATUS.CONFLICT) {
      throw new ConflictDomainException(
        `Order ${orderNumber} could not move to ${record.newStatus}`,
        {
          orderNumber,
          currentStatus: record.previousStatus,
          requestedStatus: record.newStatus,
          replayed: true,
        },
      );
    }
    if (record.reconciliationStatus === ORDER_RECONCILIATION_STATUS.PENDING) {
      // Claimed and never settled — the process died between the two. Saying
      // "done" would be a guess. The POS retries under a new key, and the
      // order's preconditions stop that re-applying anything.
      throw new ConflictDomainException(
        `A previous attempt with this idempotency key did not complete`,
        { orderNumber, requestedStatus: record.newStatus, replayed: true },
      );
    }
    return {
      orderNumber,
      externalOrderId: record.externalOrderId,
      previousStatus: record.previousStatus ?? '',
      newStatus: record.newStatus,
      replayed: true,
      alreadyInStatus: false,
    };
  }

  /**
   * Perform the transition through the merchant's own service.
   *
   * `integration.merchantId` is a User id, which is exactly what
   * `MerchantOrdersService` expects — it resolves the profile itself. The two
   * columns agreeing here is luck rather than design, and it is the same
   * `MerchantScoped` defect recorded elsewhere; `MerchantProfileResolver` is
   * used above so the ownership check does not depend on that luck.
   */
  private async transition(
    integration: MerchantIntegration,
    orderId: string,
    status: PosDrivableOrderStatus,
  ): Promise<void> {
    // The audit record MerchantOrdersService writes attributes the action to
    // the merchant's user, because that service sets the actor itself. Naming
    // the integration in the user agent is what keeps "a POS did this, not a
    // person" visible in the order's own trail.
    const context: AuditContext = { userAgent: `integration:${integration.id}` };

    switch (status) {
      case POS_DRIVABLE_ORDER_STATUS.PREPARING:
        await this.merchantOrders.acceptOrder(integration.merchantId, orderId, context);
        return;
      case POS_DRIVABLE_ORDER_STATUS.READY:
        await this.merchantOrders.markReady(integration.merchantId, orderId, context);
        return;
      default: {
        // Exhaustiveness, enforced by the compiler rather than by a test.
        // `status` has narrowed to `never` here, so adding a third member to
        // POS_DRIVABLE_ORDER_STATUS without handling it fails the build. That
        // is a stronger guarantee than any assertion, and the right one when
        // the cost of an unhandled status quietly taking the last branch is a
        // POS reaching a transition nobody meant to give it.
        const unreachable: never = status;
        throw new ValidationDomainException(
          `${String(unreachable)} is not a transition a POS may drive`,
        );
      }
    }
  }

  private async settle(recordId: string, reconciliationStatus: string): Promise<void> {
    await this.prisma.orderStatusUpdate.update({
      where: { id: recordId },
      data: { reconciliationStatus, processedAt: new Date() },
    });
  }

  private async raiseStateMismatch(
    integrationId: string,
    order: { id: string; status: OrderStatus },
    dto: UpdateOrderStatusDto,
  ): Promise<void> {
    await this.prisma.integrationConflict.create({
      data: {
        integrationId,
        conflictType: CONFLICT_TYPE.ORDER_STATE_MISMATCH,
        sourceId: order.id,
        externalId: dto.externalOrderId,
        dripplexValue: order.status,
        externalValue: dto.status,
      },
    });
  }

  private async recordAudit(
    integration: MerchantIntegration,
    orderId: string,
    orderNumber: string,
    dto: UpdateOrderStatusDto,
    alreadyInStatus: boolean,
  ): Promise<void> {
    // Empty context: no user did this, the actor is an integration. Recording a
    // fabricated userId would put a lie in the audit trail.
    await this.auditService.record(
      ORDER_SYNC_AUDIT_ACTIONS.STATUS_APPLIED,
      {},
      {
        resource: 'order',
        resourceId: orderId,
        metadata: {
          integrationId: integration.id,
          orderNumber,
          externalOrderId: dto.externalOrderId,
          newStatus: dto.status,
          alreadyInStatus,
        },
      },
    );
  }

  private async log(integrationId: string, orderNumber: string, reason: string): Promise<void> {
    await this.prisma.integrationLog.create({
      data: {
        integrationId,
        endpoint: '/api/v1/integrations/orders/:orderNumber/status',
        method: 'PUT',
        errorMessage: `[${reason}] ${orderNumber}`,
      },
    });
  }

  /**
   * Project orders into the POS view, attaching this integration's own SKUs.
   *
   * The SKU comes from `ProductSync`, so a POS sees the identifiers it sent
   * rather than DrippleX product ids it has no use for. An item the
   * integration never catalogued simply has no external SKU; it is not
   * invented, and the item is still listed because the kitchen still has to
   * make it.
   */
  private async toViews(
    integrationId: string,
    orders: Prisma.OrderGetPayload<{ include: { items: true } }>[],
  ): Promise<PosOrderView[]> {
    const productIds = [...new Set(orders.flatMap((o) => o.items.map((i) => i.productId)))];
    const mappings =
      productIds.length > 0
        ? await this.prisma.productSync.findMany({
            where: { integrationId, productId: { in: productIds } },
            select: { productId: true, externalSku: true },
          })
        : [];
    const skuByProduct = new Map(
      mappings
        .filter((m): m is { productId: string; externalSku: string } => m.productId !== null)
        .map((m) => [m.productId, m.externalSku]),
    );

    return orders.map((order) => ({
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      fulfillmentType: order.fulfillmentType,
      currency: order.currency,
      subtotal: order.subtotal.toString(),
      discount: order.discount.toString(),
      tax: order.tax.toString(),
      deliveryFee: order.deliveryFee.toString(),
      total: order.total.toString(),
      notes: order.notes,
      placedAt: order.createdAt,
      estimatedReadyAt: order.estimatedReadyAt,
      readyAt: order.readyAt,
      items: order.items.map((item) => ({
        name: item.snapshotName,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
        subtotal: item.subtotal.toString(),
        externalSku: skuByProduct.get(item.productId) ?? null,
      })),
    }));
  }
}
