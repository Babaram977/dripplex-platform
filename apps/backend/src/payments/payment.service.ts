import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  CartStatus,
  MerchantStatus,
  OrderPaymentMethod,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  TransactionStatus,
  UserStatus,
  WalletOwnerType,
} from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import { CART_REPOSITORY, type CartRepository } from '../cart/repositories/cart.repository';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { AppConfigService } from '../config/app-config.service';
import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';
import {
  NOTIFICATION_SERVICE,
  type NotificationService,
} from '../notifications/notification.service';
import {
  ORDER_WALLET_PAYMENT_REFERENCE_TYPE,
  ORDER_WALLET_REFERENCE_TYPE,
} from '../orders/order.constants';
import { toOrderDto } from '../orders/order.mapper';
import {
  ORDERS_REPOSITORY,
  type OrdersRepository,
  type OrderWithItems,
} from '../orders/repositories/orders.repository';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

import {
  INVENTORY_DEDUCTION_SERVICE,
  type InventoryDeductionService,
} from './inventory-deduction.service';
import { PAYMENT_AUDIT_ACTIONS } from './payment.constants';
import { generatePaymentReference, toPaymentTransactionDto } from './payment.mapper';
import {
  PAYMENT_PROVIDER_ADAPTERS,
  type PaymentProviderAdapter,
} from './providers/payment-provider.adapter';
import {
  PAYMENT_TRANSACTION_REPOSITORY,
  type PaymentTransactionRepository,
} from './repositories/payment-transaction.repository';

import type { InitializePaymentDto, VerifyPaymentDto } from './dto/payment.dto';
import type {
  InitializePaymentResponseDto,
  PaymentStatusDto,
  PaymentVerificationDto,
} from '@dripplex/types';
import type { Order, PaymentTransaction } from '@prisma/client';

/** Only these three OrderPaymentMethod values reach a PaymentProviderAdapter
 * — WALLET and CASH are handled entirely inside this service, exactly like
 * RidePaymentService's GATEWAY_METHODS / RIDE_PAYMENT_METHOD_TO_PROVIDER. */
const ORDER_PAYMENT_METHOD_TO_PROVIDER: Partial<Record<OrderPaymentMethod, PaymentProvider>> = {
  [OrderPaymentMethod.PAYSTACK]: 'PAYSTACK',
  [OrderPaymentMethod.FLUTTERWAVE]: 'FLUTTERWAVE',
  [OrderPaymentMethod.OPAY]: 'OPAY',
};

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @Inject(PAYMENT_TRANSACTION_REPOSITORY)
    private readonly paymentRepository: PaymentTransactionRepository,
    @Inject(ORDERS_REPOSITORY)
    private readonly ordersRepository: OrdersRepository,
    @Inject(CART_REPOSITORY)
    private readonly cartRepository: CartRepository,
    @Inject(PAYMENT_PROVIDER_ADAPTERS)
    private readonly providers: PaymentProviderAdapter[],
    @Inject(INVENTORY_DEDUCTION_SERVICE)
    private readonly inventoryDeduction: InventoryDeductionService,
    private readonly auditService: AuditService,
    @Inject(NOTIFICATION_SERVICE)
    private readonly notifications: NotificationService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly walletService: WalletService,
    @Optional()
    private readonly eventBus?: DomainEventBus,
  ) {}

  public async initializePayment(
    customerId: string,
    orderId: string,
    dto: InitializePaymentDto,
    context: AuditContext,
  ): Promise<InitializePaymentResponseDto> {
    const order = await this.requirePayableOrder(customerId, orderId);
    const method = this.resolveMethod(dto.provider);

    if (method === OrderPaymentMethod.WALLET) {
      return await this.payOrderWithWallet(order, customerId, context);
    }
    if (method === OrderPaymentMethod.CASH) {
      return await this.selectCashOnDelivery(order, customerId, context);
    }
    if (method === OrderPaymentMethod.MERCHANT_DIRECT) {
      return await this.selectMerchantDirect(order, customerId, context);
    }
    return await this.initiateGatewayPayment(order, customerId, method, dto, context);
  }

  private async initiateGatewayPayment(
    order: OrderWithItems,
    customerId: string,
    method: OrderPaymentMethod,
    dto: InitializePaymentDto,
    context: AuditContext,
  ): Promise<InitializePaymentResponseDto> {
    const provider = ORDER_PAYMENT_METHOD_TO_PROVIDER[method];
    if (!provider) {
      throw new ValidationDomainException(`Unsupported payment method: ${method}`);
    }
    const adapter = this.getAdapter(provider);

    const existingSuccess = await this.paymentRepository.findSuccessfulByOrderId(order.id);
    if (existingSuccess || order.paymentStatus === PaymentStatus.PAID) {
      throw new ConflictDomainException('Order is already paid');
    }

    const pending = await this.paymentRepository.findPendingByOrderAndProvider(order.id, provider);
    if (pending?.authorizationUrl) {
      return {
        order: toOrderDto(order),
        authorizationUrl: pending.authorizationUrl,
        reference: pending.providerReference,
        provider: pending.provider,
        transaction: toPaymentTransactionDto(pending),
      };
    }

    const customer = await this.prisma.user.findUnique({ where: { id: customerId } });
    if (!customer?.email) {
      throw new ValidationDomainException('Customer email is required for payment');
    }

    const reference = generatePaymentReference(order.orderNumber);
    const init = await adapter.initializePayment({
      email: customer.email,
      amount: Number(order.total),
      currency: order.currency,
      reference,
      orderId: order.id,
      orderNumber: order.orderNumber,
      ...(dto.callbackUrl !== undefined ? { callbackUrl: dto.callbackUrl } : {}),
    });

    const transaction = await this.paymentRepository.create({
      orderId: order.id,
      customerId: order.customerId,
      merchantId: order.merchantId,
      provider,
      providerReference: init.reference,
      amount: Number(order.total),
      currency: order.currency,
      authorizationUrl: init.authorizationUrl,
      accessCode: init.accessCode ?? null,
      providerTransactionId: init.providerTransactionId ?? null,
      gatewayResponse: init.raw ?? {},
      metadata: {
        orderNumber: order.orderNumber,
      },
    });

    const updatedOrder = await this.ordersRepository.transition(order.id, {
      status: order.status,
      paymentMethod: method,
    });

    await this.auditService.record(
      PAYMENT_AUDIT_ACTIONS.INITIALIZED,
      { ...context, userId: customerId },
      {
        resource: 'payment_transaction',
        resourceId: transaction.id,
        metadata: {
          orderId: order.id,
          provider,
          reference: transaction.providerReference,
          amount: Number(order.total),
        },
      },
    );

    return {
      order: toOrderDto({ ...order, ...updatedOrder }),
      authorizationUrl: transaction.authorizationUrl ?? init.authorizationUrl,
      reference: transaction.providerReference,
      provider: transaction.provider,
      transaction: toPaymentTransactionDto(transaction),
    };
  }

  /**
   * Pays an order with Dx Wallet balance — reuses WalletService.debit(),
   * the same primitive RidePaymentService.payWithWallet() already relies
   * on. Debit-then-finalize, no PaymentTransaction row (mirrors Ride: cash
   * and wallet fares never create a RidePaymentTransaction either).
   */
  private async payOrderWithWallet(
    order: OrderWithItems,
    customerId: string,
    context: AuditContext,
  ): Promise<InitializePaymentResponseDto> {
    await this.walletService.debit({
      ownerType: WalletOwnerType.CUSTOMER,
      ownerId: customerId,
      amount: Number(order.total),
      referenceType: ORDER_WALLET_PAYMENT_REFERENCE_TYPE,
      referenceId: order.id,
      description: `Order payment (${order.orderNumber})`,
      context,
    });

    const finalized = await this.finalizeOrderConfirmation(order, {
      paymentMethod: OrderPaymentMethod.WALLET,
      paymentStatus: PaymentStatus.PAID,
      context: { ...context, userId: customerId },
    });

    await this.auditService.record(
      PAYMENT_AUDIT_ACTIONS.INITIALIZED,
      { ...context, userId: customerId },
      {
        resource: 'order',
        resourceId: order.id,
        metadata: { method: 'WALLET', amount: Number(order.total) },
      },
    );

    const reference = `WALLET-${order.id.slice(0, 8)}`;
    await this.notifyPaymentOutcome(
      order,
      { amount: Number(order.total), currency: order.currency, reference },
      true,
    );
    await this.eventBus?.emit(
      DOMAIN_EVENTS.ORDER_PAID,
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        merchantId: order.merchantId,
        amount: Number(order.total),
        currency: order.currency,
        method: 'WALLET',
      },
      { actorUserId: customerId },
    );

    return { order: toOrderDto({ ...order, ...finalized }) };
  }

  /**
   * Records the customer's choice to pay cash at delivery. Only valid for
   * DELIVERY-fulfillment orders — see docs/MARKETPLACE-006-CASH-WALLET-PAYMENT-DESIGN.md
   * for why pickup orders don't offer this. paymentStatus stays PENDING;
   * the order is otherwise confirmed immediately (merchant starts
   * preparing) — standard cash-on-delivery behavior. Settlement happens
   * when the delivery rider completes the handoff (DeliveryService.deliver()).
   */
  private async selectCashOnDelivery(
    order: OrderWithItems,
    customerId: string,
    context: AuditContext,
  ): Promise<InitializePaymentResponseDto> {
    if (order.fulfillmentType !== 'DELIVERY') {
      throw new ValidationDomainException('Cash on delivery is only available for delivery orders');
    }

    const finalized = await this.finalizeOrderConfirmation(order, {
      paymentMethod: OrderPaymentMethod.CASH,
      paymentStatus: PaymentStatus.PENDING,
      context: { ...context, userId: customerId },
    });

    await this.auditService.record(
      PAYMENT_AUDIT_ACTIONS.INITIALIZED,
      { ...context, userId: customerId },
      { resource: 'order', resourceId: order.id, metadata: { method: 'CASH' } },
    );

    return { order: toOrderDto({ ...order, ...finalized }) };
  }

  /**
   * DPX-COMMERCIAL-001 Slice 2 — Marketplace mode B ("Pay to Merchant").
   * The customer pays the merchant directly (bank transfer/POS); DrippleX
   * never handles or digitally verifies that payment, so — unlike CASH —
   * paymentStatus stays PENDING for the order's entire lifecycle, there is
   * no rider/delivery collection step, and no fulfilment-type restriction
   * (works for pickup or delivery). The order is otherwise confirmed
   * immediately, same as CASH. Settlement (MerchantSettlementService)
   * accrues the commission owed onto the merchant's CommissionAccount
   * instead of crediting Wallet — see
   * docs/DPX-COMMERCIAL-001-REVENUE-SETTLEMENT-CREDIT-POLICY.md §3.3.
   */
  private async selectMerchantDirect(
    order: OrderWithItems,
    customerId: string,
    context: AuditContext,
  ): Promise<InitializePaymentResponseDto> {
    const finalized = await this.finalizeOrderConfirmation(order, {
      paymentMethod: OrderPaymentMethod.MERCHANT_DIRECT,
      paymentStatus: PaymentStatus.PENDING,
      context: { ...context, userId: customerId },
    });

    await this.auditService.record(
      PAYMENT_AUDIT_ACTIONS.INITIALIZED,
      { ...context, userId: customerId },
      { resource: 'order', resourceId: order.id, metadata: { method: 'MERCHANT_DIRECT' } },
    );

    return { order: toOrderDto({ ...order, ...finalized }) };
  }

  /**
   * Settles a cash-on-delivery order once the rider physically collects
   * payment. Triggered by DELIVERY_COMPLETED (see
   * CashSettlementSubscriber) rather than a direct call from
   * DeliveryService, to avoid a circular module dependency — the rider's
   * `deliver()` action is still the real-world moment this fires from,
   * mirroring RidePaymentService.confirmCash() being driver-only, never
   * customer-callable. The order is already CONFIRMED
   * (finalizeOrderConfirmation ran at selection time); this only flips
   * paymentStatus, no inventory/cart re-processing. Returns null (a
   * deliberate no-op, not an error) for the common case where the
   * delivered order wasn't paid by cash — every DELIVERY_COMPLETED event
   * reaches here regardless of payment method. Idempotent: a second call
   * on an already-PAID order is a no-op too.
   */
  public async markCashPaymentReceived(
    orderId: string,
    context: AuditContext,
  ): Promise<Order | null> {
    const order = await this.ordersRepository.findById(orderId);
    if (!order) {
      throw new NotFoundDomainException('Order not found');
    }
    if (order.paymentMethod !== OrderPaymentMethod.CASH) {
      return null;
    }
    if (order.paymentStatus === PaymentStatus.PAID) {
      return order;
    }

    const updated = await this.ordersRepository.transition(order.id, {
      status: order.status,
      paymentStatus: PaymentStatus.PAID,
    });

    await this.auditService.record(PAYMENT_AUDIT_ACTIONS.VERIFIED, context, {
      resource: 'order',
      resourceId: order.id,
      metadata: { method: 'CASH', amount: Number(order.total) },
    });

    await this.eventBus?.emit(
      DOMAIN_EVENTS.ORDER_PAID,
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        merchantId: order.merchantId,
        amount: Number(order.total),
        currency: order.currency,
        method: 'CASH',
      },
      { actorUserId: context.userId ?? null },
    );

    return updated;
  }

  public async verifyPayment(
    customerId: string,
    orderId: string,
    dto: VerifyPaymentDto,
    context: AuditContext,
  ): Promise<PaymentVerificationDto> {
    const order = await this.ordersRepository.findByIdForCustomer(orderId, customerId);
    if (!order) {
      throw new NotFoundDomainException('Order not found');
    }

    const transaction = dto.reference
      ? await this.paymentRepository.findByReference(dto.reference)
      : await this.paymentRepository.findLatestByOrderId(orderId);

    if (transaction?.orderId !== order.id) {
      throw new NotFoundDomainException('Payment transaction not found');
    }

    if (transaction.status === TransactionStatus.SUCCESS) {
      return {
        success: true,
        alreadyProcessed: true,
        orderStatus: order.status,
        paymentStatus: order.paymentStatus,
        transaction: toPaymentTransactionDto(transaction),
      };
    }

    const adapter = this.getAdapter(transaction.provider);
    const verification = await adapter.verifyPayment({
      reference: transaction.providerReference,
    });

    if (!verification.success) {
      const failed = await this.paymentRepository.markFailed({
        id: transaction.id,
        gatewayResponse: verification.gatewayResponse ?? {},
      });

      await this.auditService.record(
        PAYMENT_AUDIT_ACTIONS.FAILED,
        { ...context, userId: customerId },
        {
          resource: 'payment_transaction',
          resourceId: failed.id,
          metadata: { orderId, reference: failed.providerReference },
        },
      );

      await this.notifyPaymentOutcome(
        order,
        {
          amount: Number(failed.amount),
          currency: failed.currency,
          reference: failed.providerReference,
        },
        false,
      );
      await this.emitPaymentFailed(order, failed);

      return {
        success: false,
        alreadyProcessed: false,
        orderStatus: order.status,
        paymentStatus: order.paymentStatus,
        transaction: toPaymentTransactionDto(failed),
      };
    }

    const completed = await this.completeSuccessfulPayment({
      transaction,
      order,
      providerTransactionId: verification.providerTransactionId ?? null,
      gatewayResponse: verification.gatewayResponse,
      paidAt: verification.paidAt ?? new Date(),
      context: { ...context, userId: customerId },
      source: 'verify',
    });

    return {
      success: true,
      alreadyProcessed: completed.alreadyProcessed,
      orderStatus: OrderStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID,
      transaction: toPaymentTransactionDto(completed.transaction),
    };
  }

  public async getPayment(customerId: string, orderId: string): Promise<PaymentStatusDto> {
    const order = await this.ordersRepository.findByIdForCustomer(orderId, customerId);
    if (!order) {
      throw new NotFoundDomainException('Order not found');
    }

    const transaction = await this.paymentRepository.findLatestByOrderId(orderId);
    return {
      orderId: order.id,
      orderStatus: order.status,
      paymentStatus: order.paymentStatus,
      transaction: transaction ? toPaymentTransactionDto(transaction) : null,
    };
  }

  public async handleWebhook(
    provider: PaymentProvider,
    input: {
      rawBody: string | Buffer;
      headers: Record<string, string | string[] | undefined>;
      payload: unknown;
    },
  ): Promise<{ accepted: boolean; message: string }> {
    const adapter = this.getAdapter(provider);
    const result = await adapter.handleWebhook(input);

    if (!result.accepted) {
      await this.auditService.record(
        PAYMENT_AUDIT_ACTIONS.WEBHOOK_REJECTED,
        {},
        {
          resource: 'payment_webhook',
          metadata: { provider, reason: result.reason ?? 'rejected' },
        },
      );
      throw new ValidationDomainException(result.reason ?? 'Webhook rejected');
    }

    await this.auditService.record(
      PAYMENT_AUDIT_ACTIONS.WEBHOOK_RECEIVED,
      {},
      {
        resource: 'payment_webhook',
        metadata: {
          provider,
          event: result.event ?? null,
          reference: result.reference ?? null,
          success: result.success ?? false,
        },
      },
    );

    if (!result.reference) {
      return { accepted: true, message: 'Webhook accepted without reference' };
    }

    const transaction = await this.paymentRepository.findByReference(result.reference);
    if (!transaction) {
      this.logger.warn(`Webhook reference not found: ${result.reference}`);
      return { accepted: true, message: 'Unknown reference ignored' };
    }

    const order = await this.ordersRepository.findById(transaction.orderId);
    if (!order) {
      return { accepted: true, message: 'Order missing' };
    }

    if (result.success) {
      // Always re-verify with provider — never trust webhook alone.
      const verification = await adapter.verifyPayment({
        reference: transaction.providerReference,
      });

      if (!verification.success) {
        await this.paymentRepository.markFailed({
          id: transaction.id,
          gatewayResponse: verification.gatewayResponse ?? result.gatewayResponse ?? {},
        });
        await this.auditService.record(
          PAYMENT_AUDIT_ACTIONS.FAILED,
          {},
          {
            resource: 'payment_transaction',
            resourceId: transaction.id,
            metadata: { source: 'webhook', reference: transaction.providerReference },
          },
        );
        await this.emitPaymentFailed(order, transaction);
        return { accepted: true, message: 'Webhook received; provider verification failed' };
      }

      await this.completeSuccessfulPayment({
        transaction,
        order,
        providerTransactionId:
          verification.providerTransactionId ?? result.providerTransactionId ?? null,
        gatewayResponse: verification.gatewayResponse ?? result.gatewayResponse,
        paidAt: verification.paidAt ?? result.paidAt ?? new Date(),
        context: {},
        source: 'webhook',
      });
      return { accepted: true, message: 'Payment confirmed' };
    }

    if (transaction.status !== TransactionStatus.SUCCESS) {
      await this.paymentRepository.markFailed({
        id: transaction.id,
        gatewayResponse: result.gatewayResponse ?? {},
      });
      await this.auditService.record(
        PAYMENT_AUDIT_ACTIONS.FAILED,
        {},
        {
          resource: 'payment_transaction',
          resourceId: transaction.id,
          metadata: { source: 'webhook', reference: transaction.providerReference },
        },
      );
      await this.notifyPaymentOutcome(
        order,
        {
          amount: Number(transaction.amount),
          currency: transaction.currency,
          reference: transaction.providerReference,
        },
        false,
      );
      await this.emitPaymentFailed(order, transaction);
    }

    return { accepted: true, message: 'Payment failure recorded' };
  }

  private async completeSuccessfulPayment(input: {
    transaction: PaymentTransaction;
    order: OrderWithItems;
    providerTransactionId: string | null;
    gatewayResponse: unknown;
    paidAt: Date;
    context: AuditContext;
    source: 'verify' | 'webhook';
  }): Promise<{ transaction: PaymentTransaction; alreadyProcessed: boolean }> {
    if (input.transaction.status === TransactionStatus.SUCCESS) {
      return { transaction: input.transaction, alreadyProcessed: true };
    }

    if (input.order.paymentStatus === PaymentStatus.PAID) {
      const existing =
        (await this.paymentRepository.findSuccessfulByOrderId(input.order.id)) ?? input.transaction;
      return { transaction: existing, alreadyProcessed: true };
    }

    // Re-validate business rules before mutating state.
    await this.assertOrderStillPayable(input.order);

    const verifiedAt = new Date();
    const updated = await this.paymentRepository.markSuccess({
      id: input.transaction.id,
      verifiedAt,
      paidAt: input.paidAt,
      providerTransactionId: input.providerTransactionId,
      gatewayResponse: input.gatewayResponse ?? {},
    });

    if (!updated) {
      throw new NotFoundDomainException('Payment transaction not found');
    }

    const alreadyProcessed = false;

    // Gateway path: paymentMethod was already set at initiate time
    // (initiateGatewayPayment), so this only needs to flip status/paymentStatus.
    await this.finalizeOrderConfirmation(input.order, {
      paymentStatus: PaymentStatus.PAID,
      context: input.context,
    });

    await this.auditService.record(PAYMENT_AUDIT_ACTIONS.VERIFIED, input.context, {
      resource: 'payment_transaction',
      resourceId: updated.id,
      metadata: {
        orderId: input.order.id,
        source: input.source,
        reference: updated.providerReference,
        providerTransactionId: updated.providerTransactionId,
      },
    });

    await this.notifyPaymentOutcome(
      input.order,
      {
        amount: Number(updated.amount),
        currency: updated.currency,
        reference: updated.providerReference,
      },
      true,
    );
    await this.emitPaymentSucceeded(input.order, updated, input.source);

    return { transaction: updated, alreadyProcessed };
  }

  /**
   * Shared order-side effects for a successful payment (gateway, wallet, or
   * cash-on-delivery selection): status → CONFIRMED, inventory deducted,
   * cart marked checked-out. Safe to call unconditionally — every caller
   * reaches this only after requirePayableOrder()/assertOrderStillPayable()
   * has confirmed the order is still PENDING, so this never re-runs on an
   * already-confirmed order (inventory deduction is not safe to double-run).
   */
  private async finalizeOrderConfirmation(
    order: OrderWithItems,
    input: {
      paymentMethod?: OrderPaymentMethod;
      paymentStatus: PaymentStatus;
      context: AuditContext;
    },
  ): Promise<Order> {
    const updated = await this.ordersRepository.transition(order.id, {
      status: OrderStatus.CONFIRMED,
      paymentStatus: input.paymentStatus,
      ...(input.paymentMethod !== undefined ? { paymentMethod: input.paymentMethod } : {}),
      confirmedAt: new Date(),
    });

    await this.inventoryDeduction.deductForOrder({ orderId: order.id, context: input.context });

    if (order.cartId) {
      const cart = await this.cartRepository.findById(order.cartId);
      if (cart && cart.status !== CartStatus.CHECKED_OUT) {
        await this.cartRepository.updateStatus(order.cartId, CartStatus.CHECKED_OUT);
      }
    }

    return updated;
  }

  private async emitPaymentSucceeded(
    order: OrderWithItems,
    transaction: PaymentTransaction,
    source: 'verify' | 'webhook',
  ): Promise<void> {
    if (!this.eventBus) {
      return;
    }

    const payload = {
      orderId: order.id,
      customerId: order.customerId,
      merchantId: order.merchantId,
      transactionId: transaction.id,
      amount: Number(transaction.amount),
      currency: transaction.currency,
      provider: transaction.provider,
      source,
    };
    await this.eventBus.emit(DOMAIN_EVENTS.PAYMENT_SUCCEEDED, payload, {
      actorUserId: order.customerId,
    });
    await this.eventBus.emit(DOMAIN_EVENTS.ORDER_PAID, payload, {
      actorUserId: order.customerId,
    });
  }

  private async emitPaymentFailed(
    order: OrderWithItems,
    transaction: PaymentTransaction,
  ): Promise<void> {
    if (!this.eventBus) {
      return;
    }

    await this.eventBus.emit(
      DOMAIN_EVENTS.PAYMENT_FAILED,
      {
        orderId: order.id,
        customerId: order.customerId,
        merchantId: order.merchantId,
        transactionId: transaction.id,
        amount: Number(transaction.amount),
        currency: transaction.currency,
        provider: transaction.provider,
      },
      { actorUserId: order.customerId },
    );
  }

  private async requirePayableOrder(customerId: string, orderId: string): Promise<OrderWithItems> {
    const order = await this.ordersRepository.findByIdForCustomer(orderId, customerId);
    if (!order) {
      throw new NotFoundDomainException('Order not found');
    }
    await this.assertOrderStillPayable(order);
    return order;
  }

  private async assertOrderStillPayable(order: OrderWithItems): Promise<void> {
    if (order.status === OrderStatus.CANCELLED) {
      throw new ValidationDomainException('Cancelled orders cannot be paid');
    }
    if (order.status === OrderStatus.FAILED) {
      throw new ValidationDomainException('Expired or failed orders cannot be paid');
    }
    if (order.status === OrderStatus.CONFIRMED || order.paymentStatus === PaymentStatus.PAID) {
      throw new ConflictDomainException('Order is already paid');
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new ValidationDomainException('Order is not awaiting payment');
    }

    const reservations = order.reservations ?? [];
    const active = reservations.filter((row) => row.releasedAt === null);
    if (active.length === 0) {
      throw new ValidationDomainException('Inventory reservation is missing or released');
    }
    const now = Date.now();
    if (active.some((row) => row.expiresAt.getTime() <= now)) {
      throw new ValidationDomainException('Inventory reservation has expired');
    }

    const customer = await this.prisma.user.findUnique({ where: { id: order.customerId } });
    if (
      !customer ||
      customer.deletedAt ||
      customer.status === UserStatus.BLOCKED ||
      customer.status === UserStatus.SUSPENDED
    ) {
      throw new ValidationDomainException('Customer is blocked from payments');
    }

    // order.merchantId is MerchantProfile.id (matching Product/Cart.merchantId
    // throughout the catalog), not the merchant's User.id — see
    // cart.service.ts's validateMerchant for the same convention.
    const merchant = await this.prisma.merchantProfile.findFirst({
      where: { id: order.merchantId, deletedAt: null },
    });
    if (!merchant || merchant.status === MerchantStatus.SUSPENDED) {
      throw new ValidationDomainException('Merchant is suspended');
    }
    if (merchant.status !== MerchantStatus.APPROVED) {
      throw new ValidationDomainException('Merchant is not approved');
    }
  }

  private resolveMethod(requested?: string): OrderPaymentMethod {
    const value = (requested ?? this.config.paymentDefaultProvider).toUpperCase();
    if (value in OrderPaymentMethod) {
      return OrderPaymentMethod[value as keyof typeof OrderPaymentMethod];
    }
    throw new ValidationDomainException(`Unsupported payment method: ${value}`);
  }

  private getAdapter(provider: PaymentProvider): PaymentProviderAdapter {
    const adapter = this.providers.find((entry) => entry.provider === provider);
    if (!adapter) {
      throw new ValidationDomainException(`Payment provider adapter missing: ${provider}`);
    }
    return adapter;
  }

  private async notifyPaymentOutcome(
    order: OrderWithItems,
    info: { amount: number; currency: string; reference: string },
    success: boolean,
  ): Promise<void> {
    const [customer, merchantProfile] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: order.customerId } }),
      this.prisma.merchantProfile.findUnique({
        where: { id: order.merchantId },
        include: { user: true },
      }),
    ]);
    const merchant = merchantProfile?.user ?? null;

    if (customer?.email) {
      await this.notifications.notifyPaymentResult({
        audience: 'customer',
        email: customer.email,
        success,
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: info.amount,
        currency: info.currency,
        reference: info.reference,
      });
    }

    if (success && merchant?.email) {
      await this.notifications.notifyPaymentResult({
        audience: 'merchant',
        email: merchant.email,
        success: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: info.amount,
        currency: info.currency,
        reference: info.reference,
      });
    }
  }

  /** Admin-triggered refund. Reverses the order's paid total into the
   * customer's wallet via WalletService.refund() — regardless of the
   * original gateway — rather than calling back out to a
   * provider-specific refund API (none of the four provider adapters
   * expose one yet, see docs/MARKETPLACE-FOUNDATION.md's honest
   * limitations). `referenceType`/`referenceId` give the mutation the
   * same idempotency guarantee every other wallet-crediting flow in this
   * codebase relies on (WalletService.applyMutation skips a mutation that
   * already has a ledger entry for the same reference pair). */
  public async refundOrder(
    adminId: string,
    orderId: string,
    reason: string,
    context: AuditContext,
  ): Promise<OrderWithItems> {
    const order = await this.ordersRepository.findById(orderId);
    if (!order) {
      throw new NotFoundDomainException('Order not found');
    }
    if (order.status === OrderStatus.REFUNDED) {
      throw new ConflictDomainException('Order has already been refunded');
    }
    if (order.paymentStatus !== PaymentStatus.PAID) {
      throw new ValidationDomainException('Only paid orders can be refunded');
    }

    await this.walletService.refund({
      ownerType: WalletOwnerType.CUSTOMER,
      ownerId: order.customerId,
      amount: Number(order.total),
      referenceType: ORDER_WALLET_REFERENCE_TYPE,
      referenceId: order.id,
      description: `Refund for order ${order.orderNumber}`,
      context,
    });

    await this.ordersRepository.transition(order.id, {
      status: OrderStatus.REFUNDED,
      paymentStatus: PaymentStatus.REFUNDED,
      refundedAt: new Date(),
    });

    await this.auditService.record(
      PAYMENT_AUDIT_ACTIONS.REFUNDED,
      { ...context, userId: adminId },
      {
        resource: 'order',
        resourceId: order.id,
        metadata: { reason, amount: Number(order.total) },
      },
    );

    await this.eventBus?.emit(
      DOMAIN_EVENTS.ORDER_REFUNDED,
      {
        orderId: order.id,
        customerId: order.customerId,
        merchantId: order.merchantId,
        amount: String(order.total),
        reason,
      },
      { actorUserId: adminId },
    );

    const refreshed = await this.ordersRepository.findById(order.id);
    if (!refreshed) {
      throw new NotFoundDomainException('Order not found after refund');
    }
    return refreshed;
  }
}
