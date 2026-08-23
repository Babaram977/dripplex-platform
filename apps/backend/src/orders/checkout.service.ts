import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  CartStatus,
  CommissionOwnerType,
  FulfillmentType,
  MerchantStatus,
  OrderDisputeStatus,
  OrderStatus,
  PaymentStatus,
  UserStatus,
} from '@prisma/client';

import {
  ADDRESS_REPOSITORY,
  type AddressRepository,
} from '../addresses/repositories/address.repository';
import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  CART_REPOSITORY,
  type CartRepository,
  type CartWithItems,
} from '../cart/repositories/cart.repository';
import { CommissionAccountService } from '../commercial/commission-account.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';
import {
  NOTIFICATION_SERVICE,
  type NotificationService,
} from '../notifications/notification.service';
import { PricingService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';

import { CheckoutFulfillmentType } from './dto/order.dto';
import { CHECKOUT_INVENTORY_VALIDATOR } from './inventory/checkout-inventory.validator';
import { InventoryReservationService } from './inventory/inventory-reservation.service';
import { ORDER_AUDIT_ACTIONS } from './order.constants';
import { generateOrderNumber, roundMoney, toCheckoutResponseDto, toOrderDto } from './order.mapper';
import { CHECKOUT_PRODUCT_VALIDATOR } from './pricing/checkout-product.validator';
import {
  ORDERS_REPOSITORY,
  type OrdersRepository,
  type OrderWithItems,
} from './repositories/orders.repository';

import type { CheckoutDto } from './dto/order.dto';
import type { CheckoutInventoryValidator } from './inventory/checkout-inventory.validator';
import type { CheckoutProductValidator } from './pricing/checkout-product.validator';
import type {
  CheckoutResponseDto,
  CustomerMerchantBankDto,
  OrderDto,
  PaginatedResult,
} from '@dripplex/types';

@Injectable()
export class CheckoutService {
  constructor(
    @Inject(ORDERS_REPOSITORY)
    private readonly ordersRepository: OrdersRepository,
    @Inject(CART_REPOSITORY)
    private readonly cartRepository: CartRepository,
    @Inject(ADDRESS_REPOSITORY)
    private readonly addressRepository: AddressRepository,
    @Inject(CHECKOUT_PRODUCT_VALIDATOR)
    private readonly productValidator: CheckoutProductValidator,
    @Inject(CHECKOUT_INVENTORY_VALIDATOR)
    private readonly inventoryValidator: CheckoutInventoryValidator,
    private readonly pricingService: PricingService,
    private readonly reservationService: InventoryReservationService,
    private readonly auditService: AuditService,
    private readonly commissionAccounts: CommissionAccountService,
    @Inject(NOTIFICATION_SERVICE)
    private readonly notifications: NotificationService,
    private readonly prisma: PrismaService,
    @Optional()
    private readonly eventBus?: DomainEventBus,
  ) {}

  public async checkout(
    customerId: string,
    dto: CheckoutDto,
    context: AuditContext,
  ): Promise<CheckoutResponseDto> {
    await this.assertCustomerVerified(customerId);

    // A locked cart means checkout already ran and an order for it is sitting
    // unpaid. That order IS this checkout — the cart could not have changed
    // since, because locking is what stops it changing. Hand it back.
    //
    // Refusing instead is what customers hit as "I cannot complete my order":
    // reach checkout, leave the app before paying, come back, and every
    // attempt answered "Cart is locked pending payment" until the cleanup
    // sweep released it half an hour later. Worse when the order carries no
    // inventory reservation, because that sweep only unlocks carts whose
    // reservations expired — nothing else ever unlocks them, so the cart
    // stayed dead and the sale was simply lost.
    //
    // Resuming rather than cancelling and re-creating is deliberate: a card
    // payment may already be in flight on that order, and cancelling it to
    // start a fresh one risks charging for an order nobody will fulfil.
    const resumed = await this.findResumableOrder(customerId, dto.cartId);
    if (resumed) {
      return toCheckoutResponseDto(resumed);
    }

    const cart = await this.resolveCart(customerId, dto.cartId);
    this.assertCartCheckoutable(cart);

    await this.assertMerchantApproved(cart.merchantId);

    const inventoryItems = cart.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
    }));
    await this.inventoryValidator.assertAvailable(inventoryItems);

    const productSnapshots = await this.productValidator.resolve(
      cart.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        unitPrice: Number(item.unitPriceSnapshot),
      })),
    );

    for (const snapshot of productSnapshots) {
      if (snapshot.deleted) {
        throw new ValidationDomainException(`Product ${snapshot.productId} has been deleted`);
      }
      if (!snapshot.active) {
        throw new ValidationDomainException(`Product ${snapshot.productId} is inactive`);
      }
    }

    const fulfillmentType =
      dto.fulfillmentType === CheckoutFulfillmentType.PICKUP
        ? FulfillmentType.PICKUP
        : FulfillmentType.DELIVERY;

    let deliveryAddressId: string | null = null;
    if (fulfillmentType === FulfillmentType.DELIVERY) {
      deliveryAddressId = await this.resolveDeliveryAddress(customerId, dto.deliveryAddressId);
    }

    const subtotal = roundMoney(cart.items.reduce((sum, item) => sum + Number(item.subtotal), 0));

    const pricing = await this.pricingService.computeTotals({
      subtotal,
      customerId,
      merchantId: cart.merchantId,
      fulfillmentType: fulfillmentType === FulfillmentType.PICKUP ? 'PICKUP' : 'DELIVERY',
      ...(dto.couponCode !== undefined ? { couponCode: dto.couponCode } : {}),
    });
    const { discount, tax, deliveryFee, total } = pricing;

    const order = await this.ordersRepository.create({
      customerId,
      merchantId: cart.merchantId,
      cartId: cart.id,
      orderNumber: generateOrderNumber(),
      fulfillmentType,
      subtotal,
      discount,
      tax,
      deliveryFee,
      total,
      currency: cart.currency,
      couponCode: pricing.couponCode,
      deliveryAddressId,
      notes: (() => {
        const trimmed = dto.notes?.trim();
        return trimmed && trimmed.length > 0 ? trimmed : null;
      })(),
      items: cart.items.map((item) => {
        const snapshot = productSnapshots.find(
          (row) =>
            row.productId === item.productId &&
            (row.variantId ?? null) === (item.variantId ?? null),
        );
        const snapshotName =
          item.productNameSnapshot.length > 0
            ? item.productNameSnapshot
            : (snapshot?.name ?? `Product ${item.productId}`);
        return {
          productId: item.productId,
          variantId: item.variantId,
          merchantId: cart.merchantId,
          quantity: item.quantity,
          unitPrice: Number(item.unitPriceSnapshot),
          subtotal: Number(item.subtotal),
          snapshotName,
          snapshotImage: item.imageSnapshot ?? snapshot?.imageUrl ?? null,
          snapshotSku: item.skuSnapshot ?? snapshot?.sku ?? null,
        };
      }),
    });

    await this.reservationService.reserve({
      orderId: order.id,
      items: inventoryItems,
      context: { ...context, userId: customerId },
    });

    await this.cartRepository.updateStatus(cart.id, CartStatus.LOCKED);

    await this.auditService.record(
      ORDER_AUDIT_ACTIONS.CREATED,
      { ...context, userId: customerId },
      {
        resource: 'order',
        resourceId: order.id,
        metadata: {
          orderNumber: order.orderNumber,
          merchantId: cart.merchantId,
          total,
          itemCount: order.items.length,
        },
      },
    );

    if (pricing.couponCode) {
      await this.eventBus?.emit(
        DOMAIN_EVENTS.COUPON_REDEEMED,
        {
          orderId: order.id,
          customerId,
          merchantId: cart.merchantId,
          couponCode: pricing.couponCode,
          discount,
        },
        { actorUserId: customerId },
      );
    }

    await this.dispatchOrderCreatedNotifications(order);

    const refreshed = await this.ordersRepository.findById(order.id);
    if (!refreshed) {
      throw new NotFoundDomainException('Order not found after checkout');
    }

    return toCheckoutResponseDto(refreshed);
  }

  public async listCustomerOrders(
    customerId: string,
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<OrderDto>> {
    const { items, total } = await this.ordersRepository.list({
      customerId,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return {
      items: items.map(toOrderDto),
      meta: {
        page,
        limit: pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
      },
    };
  }

  public async getCustomerOrder(customerId: string, orderId: string): Promise<OrderDto> {
    const order = await this.ordersRepository.findByIdForCustomer(orderId, customerId);
    if (!order) {
      throw new NotFoundDomainException('Order not found');
    }
    return toOrderDto(order);
  }

  /// Returns the default payout bank account of the order's merchant, for a
  /// customer who owns the order. Read-only — no settlement, commission, or
  /// payment-movement logic is touched; this only exposes existing merchant
  /// bank data so the MERCHANT_DIRECT checkout option can show where to pay.
  ///
  /// Order.merchantId references MerchantProfile.id (the catalog convention,
  /// same as assertMerchantApproved / dispatchOrderCreatedNotifications above),
  /// while BankAccount.merchantId references the merchant's User.id — so the
  /// profile's userId bridges the two hops.
  public async getOrderMerchantBank(
    customerId: string,
    orderId: string,
  ): Promise<CustomerMerchantBankDto> {
    const order = await this.ordersRepository.findByIdForCustomer(orderId, customerId);
    if (!order) {
      throw new NotFoundDomainException('Order not found');
    }

    const profile = await this.prisma.merchantProfile.findUnique({
      where: { id: order.merchantId },
    });
    if (!profile) {
      throw new NotFoundDomainException('Merchant not found');
    }

    const account = await this.prisma.bankAccount.findFirst({
      where: { merchantId: profile.userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    if (!account) {
      throw new NotFoundDomainException('Merchant has no payout account on file');
    }

    return {
      bankName: account.bankName,
      accountName: account.accountName,
      accountNumber: account.accountNumber,
      currency: account.currency,
    };
  }

  public async cancelCustomerOrder(
    customerId: string,
    orderId: string,
    context: AuditContext,
    reason?: string,
  ): Promise<OrderDto> {
    const order = await this.ordersRepository.findByIdForCustomer(orderId, customerId);
    if (!order) {
      throw new NotFoundDomainException('Order not found');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new ValidationDomainException('Only orders pending payment can be cancelled');
    }

    await this.reservationService.releaseForOrder({
      orderId: order.id,
      context: { ...context, userId: customerId },
      reason: reason ?? 'customer_cancel',
    });

    await this.ordersRepository.transition(order.id, {
      status: OrderStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelledBy: 'CUSTOMER',
      ...(reason !== undefined ? { cancellationReason: reason } : {}),
    });

    if (order.cartId) {
      const cart = await this.cartRepository.findById(order.cartId);
      if (cart?.status === CartStatus.LOCKED) {
        await this.cartRepository.updateStatus(order.cartId, CartStatus.ACTIVE);
      }
    }

    await this.auditService.record(
      ORDER_AUDIT_ACTIONS.CANCELLED,
      { ...context, userId: customerId },
      {
        resource: 'order',
        resourceId: order.id,
        metadata: { reason: reason ?? null },
      },
    );

    const refreshed = await this.ordersRepository.findById(order.id);
    if (!refreshed) {
      throw new NotFoundDomainException('Order not found after cancel');
    }
    await this.eventBus?.emit(
      DOMAIN_EVENTS.ORDER_CANCELLED,
      {
        orderId: refreshed.id,
        customerId: refreshed.customerId,
        merchantId: refreshed.merchantId,
        reason: reason ?? null,
      },
      { actorUserId: customerId },
    );
    return toOrderDto(refreshed);
  }

  public async listAdminOrders(input: {
    status?: string;
    paymentStatus?: string;
    merchantId?: string;
    customerId?: string;
    createdFrom?: string;
    createdTo?: string;
    page: number;
    pageSize: number;
  }): Promise<PaginatedResult<OrderDto>> {
    const { items, total } = await this.ordersRepository.list({
      ...(input.customerId ? { customerId: input.customerId } : {}),
      ...(input.merchantId ? { merchantId: input.merchantId } : {}),
      ...(input.status ? { status: input.status as OrderWithItems['status'] } : {}),
      ...(input.paymentStatus
        ? { paymentStatus: input.paymentStatus as OrderWithItems['paymentStatus'] }
        : {}),
      ...(input.createdFrom ? { createdFrom: new Date(input.createdFrom) } : {}),
      ...(input.createdTo ? { createdTo: new Date(input.createdTo) } : {}),
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    });

    return {
      items: items.map(toOrderDto),
      meta: {
        page: input.page,
        limit: input.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize) || 1),
      },
    };
  }

  public async getAdminOrder(orderId: string): Promise<OrderDto> {
    const order = await this.ordersRepository.findById(orderId);
    if (!order) {
      throw new NotFoundDomainException('Order not found');
    }
    return toOrderDto(order);
  }

  public async raiseDispute(
    customerId: string,
    orderId: string,
    reason: string,
    context: AuditContext,
  ): Promise<OrderDto> {
    const order = await this.ordersRepository.findByIdForCustomer(orderId, customerId);
    if (!order) {
      throw new NotFoundDomainException('Order not found');
    }
    if (order.status !== OrderStatus.DELIVERED) {
      throw new ValidationDomainException('Only delivered orders can be disputed');
    }

    const existing = await this.ordersRepository.findOpenDisputeForOrder(order.id);
    if (existing) {
      throw new ConflictDomainException('This order already has an open dispute');
    }

    await this.ordersRepository.createDispute({ orderId: order.id, raisedBy: customerId, reason });
    await this.ordersRepository.transition(order.id, { status: OrderStatus.DISPUTED });

    await this.auditService.record(
      ORDER_AUDIT_ACTIONS.DISPUTE_RAISED,
      { ...context, userId: customerId },
      { resource: 'order', resourceId: order.id, metadata: { reason } },
    );

    await this.eventBus?.emit(
      DOMAIN_EVENTS.ORDER_DISPUTED,
      { orderId: order.id, customerId, merchantId: order.merchantId, reason },
      { actorUserId: customerId },
    );

    const refreshed = await this.ordersRepository.findById(order.id);
    if (!refreshed) {
      throw new NotFoundDomainException('Order not found after dispute');
    }
    return toOrderDto(refreshed);
  }

  public async resolveDispute(
    adminId: string,
    disputeId: string,
    resolution: string,
    context: AuditContext,
  ): Promise<OrderDto> {
    const dispute = await this.ordersRepository.findDisputeById(disputeId);
    if (!dispute) {
      throw new NotFoundDomainException('Dispute not found');
    }
    if (dispute.status === OrderDisputeStatus.RESOLVED) {
      throw new ConflictDomainException('Dispute has already been resolved');
    }

    await this.ordersRepository.resolveDispute(dispute.id, {
      status: OrderDisputeStatus.RESOLVED,
      resolution,
      resolvedBy: adminId,
    });
    await this.ordersRepository.transition(dispute.orderId, {
      status: OrderStatus.COMPLETED,
      completedAt: new Date(),
    });

    await this.auditService.record(
      ORDER_AUDIT_ACTIONS.DISPUTE_RESOLVED,
      { ...context, userId: adminId },
      { resource: 'order', resourceId: dispute.orderId, metadata: { resolution } },
    );

    const refreshed = await this.ordersRepository.findById(dispute.orderId);
    if (!refreshed) {
      throw new NotFoundDomainException('Order not found after dispute resolution');
    }

    await this.eventBus?.emit(
      DOMAIN_EVENTS.ORDER_DISPUTE_RESOLVED,
      {
        orderId: refreshed.id,
        customerId: refreshed.customerId,
        merchantId: refreshed.merchantId,
        resolution,
      },
      { actorUserId: adminId },
    );

    return toOrderDto(refreshed);
  }

  /**
   * The unpaid order holding this customer's cart locked, if there is one.
   *
   * Only an order that is still PENDING and still awaiting payment qualifies.
   * One already paid, cancelled or failed has no claim on the cart — and for
   * those the ordinary path is right: the lock is stale and
   * `assertCartCheckoutable` should say so rather than resurrect a dead order.
   */
  private async findResumableOrder(
    customerId: string,
    cartId?: string,
  ): Promise<OrderWithItems | null> {
    const cart = cartId
      ? await this.cartRepository.findByIdForCustomer(cartId, customerId)
      : await this.cartRepository.findLockedByCustomerId(customerId);
    if (cart?.status !== CartStatus.LOCKED) {
      return null;
    }

    const existing = await this.ordersRepository.findByCartId(cart.id);
    if (
      existing?.status !== OrderStatus.PENDING ||
      existing.paymentStatus !== PaymentStatus.PENDING
    ) {
      return null;
    }
    return await this.ordersRepository.findById(existing.id);
  }

  private async resolveCart(customerId: string, cartId?: string): Promise<CartWithItems> {
    if (cartId) {
      const cart = await this.cartRepository.findByIdForCustomer(cartId, customerId);
      if (!cart) {
        throw new NotFoundDomainException('Cart not found');
      }
      return cart;
    }

    const locked = await this.cartRepository.findLockedByCustomerId(customerId);
    if (locked) {
      throw new ConflictDomainException('Cart is locked pending payment');
    }

    const cart = await this.cartRepository.findActiveByCustomerId(customerId);
    if (!cart) {
      throw new NotFoundDomainException('Active cart not found');
    }
    return cart;
  }

  private assertCartCheckoutable(cart: CartWithItems): void {
    if (cart.status === CartStatus.LOCKED) {
      throw new ConflictDomainException('Cart is locked pending payment');
    }
    if (cart.status === CartStatus.CHECKED_OUT) {
      throw new ConflictDomainException('Cart has already been checked out');
    }
    if (cart.status !== CartStatus.ACTIVE) {
      throw new ValidationDomainException('Cart is not available for checkout');
    }
    if (cart.items.length === 0) {
      throw new ValidationDomainException('Cart is empty');
    }
  }

  private async resolveDeliveryAddress(
    customerId: string,
    deliveryAddressId?: string,
  ): Promise<string> {
    if (deliveryAddressId) {
      const address = await this.addressRepository.findByIdForCustomer(
        deliveryAddressId,
        customerId,
      );
      if (!address?.isActive) {
        throw new ValidationDomainException('Delivery address is invalid');
      }
      return address.id;
    }

    const defaultAddress = await this.addressRepository.findDefault(customerId);
    if (!defaultAddress) {
      throw new ValidationDomainException('Delivery address is required');
    }
    return defaultAddress.id;
  }

  private async assertCustomerVerified(customerId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: customerId } });
    if (!user || user.deletedAt) {
      throw new NotFoundDomainException('Customer not found');
    }
    if (user.status !== UserStatus.ACTIVE || !user.emailVerifiedAt) {
      throw new ValidationDomainException('Customer must be verified to checkout');
    }
  }

  private async assertMerchantApproved(merchantId: string): Promise<void> {
    // merchantId here is MerchantProfile.id (matching Product/Cart.merchantId
    // throughout the catalog), not the merchant's User.id — see
    // cart.service.ts's validateMerchant for the same convention.
    const profile = await this.prisma.merchantProfile.findFirst({
      where: { id: merchantId, deletedAt: null },
    });
    if (!profile) {
      throw new NotFoundDomainException('Merchant not found');
    }
    if (profile.status !== MerchantStatus.APPROVED) {
      throw new ValidationDomainException('Merchant is not approved for orders');
    }

    // DPX-COMMERCIAL-001 Slice 2 §3.6 — a merchant whose outstanding
    // commission balance exceeds their credit limit cannot receive new
    // orders (already-in-flight orders are untouched, same as an
    // unapproved/suspended merchant is rejected only at creation time,
    // never retroactively). CommissionAccount.ownerId is the merchant's
    // User.id (matching Wallet's convention), not MerchantProfile.id.
    const commissionAccount = await this.commissionAccounts.getOrCreateAccount(
      CommissionOwnerType.MERCHANT,
      profile.userId,
    );
    if (commissionAccount.blocked) {
      throw new ValidationDomainException(
        'Merchant is currently blocked from receiving new orders due to an outstanding commission balance',
      );
    }
  }

  private async dispatchOrderCreatedNotifications(order: OrderWithItems): Promise<void> {
    const [customer, merchantProfile] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: order.customerId } }),
      this.prisma.merchantProfile.findUnique({
        where: { id: order.merchantId },
        include: { user: true },
      }),
    ]);
    const merchant = merchantProfile?.user ?? null;

    if (customer?.email) {
      await this.notifications.notifyOrderCreated({
        audience: 'customer',
        email: customer.email,
        orderId: order.id,
        orderNumber: order.orderNumber,
        total: Number(order.total),
        currency: order.currency,
      });
    }

    if (merchant?.email) {
      await this.notifications.notifyOrderCreated({
        audience: 'merchant',
        email: merchant.email,
        orderId: order.id,
        orderNumber: order.orderNumber,
        total: Number(order.total),
        currency: order.currency,
      });
    }
  }
}
