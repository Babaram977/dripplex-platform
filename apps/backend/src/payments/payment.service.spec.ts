import { createHmac } from 'node:crypto';

import { NotImplementedException } from '@nestjs/common';
import {
  CartStatus,
  FulfillmentType,
  MerchantStatus,
  OrderPaymentMethod,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  TransactionStatus,
  UserStatus,
} from '@prisma/client';

import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { DOMAIN_EVENTS } from '../events/domain-events';
import { ORDER_WALLET_PAYMENT_REFERENCE_TYPE } from '../orders/order.constants';

import { OrderPaymentMethodDtoEnum } from './dto/payment.dto';
import { PAYMENT_AUDIT_ACTIONS } from './payment.constants';
import { PaymentService } from './payment.service';
import { FlutterwaveProvider } from './providers/flutterwave.provider';
import { MoniepointProvider } from './providers/moniepoint.provider';
import { PaystackProvider } from './providers/paystack.provider';

import type { InventoryDeductionService } from './inventory-deduction.service';
import type { AuditService } from '../audit/audit.service';
import type { CartRepository } from '../cart/repositories/cart.repository';
import type { AppConfigService } from '../config/app-config.service';
import type { DomainEventBus } from '../events/domain-event-bus';
import type { NotificationService } from '../notifications/notification.service';
import type { OrdersRepository, OrderWithItems } from '../orders/repositories/orders.repository';
import type { PrismaService } from '../prisma/prisma.service';
import type { WalletService } from '../wallet/wallet.service';
import type { PaymentProviderAdapter } from './providers/payment-provider.adapter';
import type { PaymentTransactionRepository } from './repositories/payment-transaction.repository';
import type { PaymentTransaction } from '@prisma/client';

const customerId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const merchantId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const orderId = '11111111-1111-1111-1111-111111111111';
const cartId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const txnId = '55555555-5555-5555-5555-555555555555';
const reference = 'DPX-PAY-TEST-REF';

const sampleOrder = {
  id: orderId,
  customerId,
  merchantId,
  cartId,
  orderNumber: 'DPX-20260721-ABC123',
  status: OrderStatus.PENDING,
  paymentStatus: PaymentStatus.PENDING,
  total: 5000,
  currency: 'NGN',
  fulfillmentType: FulfillmentType.PICKUP,
  deliveryAddressId: null,
  deliveryFee: 0,
  discount: 0,
  tax: 0,
  subtotal: 5000,
  couponCode: null,
  notes: null,
  estimatedReadyAt: null,
  confirmedAt: null,
  readyAt: null,
  deliveredAt: null,
  completedAt: null,
  cancelledAt: null,
  cancelledBy: null,
  cancellationReason: null,
  refundedAt: null,
  paymentMethod: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  reservations: [
    {
      id: '66666666-6666-6666-6666-666666666666',
      orderId,
      productId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      variantId: null,
      quantity: 2,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      releasedAt: null,
      createdAt: new Date(),
    },
  ],
  items: [],
} as unknown as OrderWithItems;

const sampleTxn = {
  id: txnId,
  orderId,
  customerId,
  merchantId,
  provider: PaymentProvider.PAYSTACK,
  providerReference: reference,
  providerTransactionId: null,
  status: TransactionStatus.PENDING,
  amount: 5000,
  currency: 'NGN',
  authorizationUrl: 'https://checkout.paystack.com/test',
  accessCode: 'access',
  gatewayResponse: {},
  paidAt: null,
  verifiedAt: null,
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as PaymentTransaction;

describe('PaymentService', () => {
  const paymentRepository: jest.Mocked<PaymentTransactionRepository> = {
    create: jest.fn(),
    findById: jest.fn(),
    findByReference: jest.fn(),
    findByOrderId: jest.fn(),
    findLatestByOrderId: jest.fn(),
    findPendingByOrderAndProvider: jest.fn(),
    findSuccessfulByOrderId: jest.fn(),
    markSuccess: jest.fn(),
    markFailed: jest.fn(),
    updateStatus: jest.fn(),
  };

  const ordersRepository: jest.Mocked<OrdersRepository> = {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdForCustomer: jest.fn(),
    findByIdForMerchant: jest.fn(),
    list: jest.fn(),
    transition: jest.fn(),
    findByCartId: jest.fn(),
    createReservations: jest.fn(),
    releaseReservationsForOrder: jest.fn(),
    findExpiredActiveReservations: jest.fn(),
    findUnpaidOrdersWithExpiredReservations: jest.fn(),
    findAutoCompletableOrders: jest.fn(),
    createDispute: jest.fn(),
    findDisputeById: jest.fn(),
    findOpenDisputeForOrder: jest.fn(),
    resolveDispute: jest.fn(),
  };

  const cartRepository: jest.Mocked<CartRepository> = {
    findActiveByCustomerId: jest.fn(),
    findLockedByCustomerId: jest.fn(),
    findOpenByCustomerId: jest.fn(),
    findById: jest.fn(),
    findByIdForCustomer: jest.fn(),
    createCart: jest.fn(),
    addItem: jest.fn(),
    updateItem: jest.fn(),
    removeItem: jest.fn(),
    findItemById: jest.fn(),
    findDuplicateItem: jest.fn(),
    clearItems: jest.fn(),
    updateTotals: jest.fn(),
    updateStatus: jest.fn(),
    abandonActiveCarts: jest.fn(),
  };

  const provider: jest.Mocked<PaymentProviderAdapter> = {
    provider: PaymentProvider.PAYSTACK,
    initializePayment: jest.fn(),
    verifyPayment: jest.fn(),
    handleWebhook: jest.fn(),
  };

  const inventoryDeduction = {
    deductForOrder: jest.fn().mockResolvedValue({ deducted: 1 }),
  } as unknown as jest.Mocked<InventoryDeductionService>;

  const auditService = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditService>;

  const notifications = {
    notifyPaymentResult: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<NotificationService>;

  const prisma = {
    user: { findUnique: jest.fn() },
    merchantProfile: { findFirst: jest.fn(), findUnique: jest.fn() },
  } as unknown as PrismaService;

  const config = {
    paymentDefaultProvider: 'PAYSTACK',
  } as unknown as AppConfigService;

  const walletService = {
    debit: jest.fn().mockResolvedValue(undefined),
    refund: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<WalletService>;

  const service = new PaymentService(
    paymentRepository,
    ordersRepository,
    cartRepository,
    [provider],
    inventoryDeduction,
    auditService,
    notifications,
    prisma,
    config,
    walletService,
  );

  const context = { userId: customerId };

  beforeEach(() => {
    jest.clearAllMocks();
    ordersRepository.findByIdForCustomer.mockResolvedValue(sampleOrder);
    ordersRepository.findById.mockResolvedValue(sampleOrder);
    ordersRepository.transition.mockResolvedValue({
      ...sampleOrder,
      status: OrderStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID,
    });
    paymentRepository.findSuccessfulByOrderId.mockResolvedValue(null);
    paymentRepository.findPendingByOrderAndProvider.mockResolvedValue(null);
    paymentRepository.create.mockResolvedValue(sampleTxn);
    paymentRepository.findLatestByOrderId.mockResolvedValue(sampleTxn);
    paymentRepository.findByReference.mockResolvedValue(sampleTxn);
    paymentRepository.markSuccess.mockResolvedValue({
      ...sampleTxn,
      status: TransactionStatus.SUCCESS,
      verifiedAt: new Date(),
      paidAt: new Date(),
    });
    paymentRepository.markFailed.mockResolvedValue({
      ...sampleTxn,
      status: TransactionStatus.FAILED,
    });
    provider.initializePayment.mockResolvedValue({
      provider: PaymentProvider.PAYSTACK,
      reference,
      authorizationUrl: 'https://checkout.paystack.com/test',
      accessCode: 'access',
    });
    provider.verifyPayment.mockResolvedValue({
      success: true,
      reference,
      providerTransactionId: '999',
      amount: 5000,
      currency: 'NGN',
      paidAt: new Date(),
    });
    provider.handleWebhook.mockResolvedValue({
      accepted: true,
      event: 'charge.success',
      reference,
      success: true,
      providerTransactionId: '999',
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: customerId,
      email: 'customer@example.com',
      status: UserStatus.ACTIVE,
      deletedAt: null,
    });
    (prisma.merchantProfile.findFirst as jest.Mock).mockResolvedValue({
      userId: merchantId,
      status: MerchantStatus.APPROVED,
      deletedAt: null,
    });
    (prisma.merchantProfile.findUnique as jest.Mock).mockResolvedValue({
      id: merchantId,
      userId: merchantId,
      user: { id: merchantId, email: 'merchant@example.com' },
    });
    cartRepository.findById.mockResolvedValue({
      id: cartId,
      status: CartStatus.LOCKED,
    } as never);
  });

  describe('initializePayment', () => {
    it('initializes payment and records audit', async () => {
      const result = await service.initializePayment(customerId, orderId, {}, context);
      expect(result.authorizationUrl).toContain('paystack');
      expect(result.reference).toBe(reference);
      expect(paymentRepository.create).toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        PAYMENT_AUDIT_ACTIONS.INITIALIZED,
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('returns existing pending transaction idempotently', async () => {
      paymentRepository.findPendingByOrderAndProvider.mockResolvedValue(sampleTxn);
      const result = await service.initializePayment(
        customerId,
        orderId,
        { provider: OrderPaymentMethodDtoEnum.PAYSTACK },
        context,
      );
      expect(result.reference).toBe(reference);
      expect(provider.initializePayment).not.toHaveBeenCalled();
    });

    it('rejects already paid orders', async () => {
      paymentRepository.findSuccessfulByOrderId.mockResolvedValue({
        ...sampleTxn,
        status: TransactionStatus.SUCCESS,
      });
      await expect(
        service.initializePayment(customerId, orderId, {}, context),
      ).rejects.toBeInstanceOf(ConflictDomainException);
    });

    it('rejects cancelled orders', async () => {
      ordersRepository.findByIdForCustomer.mockResolvedValue({
        ...sampleOrder,
        status: OrderStatus.CANCELLED,
      });
      await expect(
        service.initializePayment(customerId, orderId, {}, context),
      ).rejects.toBeInstanceOf(ValidationDomainException);
    });

    it('rejects expired reservations', async () => {
      const reservation = sampleOrder.reservations?.[0];
      ordersRepository.findByIdForCustomer.mockResolvedValue({
        ...sampleOrder,
        reservations: reservation
          ? [
              {
                ...reservation,
                expiresAt: new Date(Date.now() - 1000),
              },
            ]
          : [],
      });
      await expect(
        service.initializePayment(customerId, orderId, {}, context),
      ).rejects.toBeInstanceOf(ValidationDomainException);
    });

    it('rejects suspended merchants', async () => {
      (prisma.merchantProfile.findFirst as jest.Mock).mockResolvedValue({
        userId: merchantId,
        status: MerchantStatus.SUSPENDED,
        deletedAt: null,
      });
      await expect(
        service.initializePayment(customerId, orderId, {}, context),
      ).rejects.toBeInstanceOf(ValidationDomainException);
    });

    it('rejects blocked customers', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: customerId,
        email: 'customer@example.com',
        status: UserStatus.BLOCKED,
        deletedAt: null,
      });
      await expect(
        service.initializePayment(customerId, orderId, {}, context),
      ).rejects.toBeInstanceOf(ValidationDomainException);
    });
  });

  describe('WALLET payment', () => {
    it('debits the wallet and confirms the order immediately', async () => {
      const result = await service.initializePayment(
        customerId,
        orderId,
        { provider: OrderPaymentMethodDtoEnum.WALLET },
        context,
      );

      expect(walletService.debit).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: customerId,
          amount: 5000,
          referenceType: ORDER_WALLET_PAYMENT_REFERENCE_TYPE,
          referenceId: orderId,
        }),
      );
      expect(ordersRepository.transition).toHaveBeenCalledWith(orderId, {
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: OrderPaymentMethod.WALLET,
        confirmedAt: expect.any(Date),
      });
      expect(inventoryDeduction.deductForOrder).toHaveBeenCalled();
      expect(cartRepository.updateStatus).toHaveBeenCalledWith(cartId, CartStatus.CHECKED_OUT);
      expect(result.authorizationUrl).toBeUndefined();
      expect(result.order.paymentStatus).toBe(PaymentStatus.PAID);
      expect(provider.initializePayment).not.toHaveBeenCalled();
    });

    it('leaves the order unpaid when the wallet debit fails', async () => {
      walletService.debit.mockRejectedValue(new ValidationDomainException('Insufficient balance'));
      await expect(
        service.initializePayment(
          customerId,
          orderId,
          { provider: OrderPaymentMethodDtoEnum.WALLET },
          context,
        ),
      ).rejects.toBeInstanceOf(ValidationDomainException);
      expect(ordersRepository.transition).not.toHaveBeenCalled();
    });
  });

  describe('CASH payment', () => {
    const deliveryOrder = { ...sampleOrder, fulfillmentType: FulfillmentType.DELIVERY };

    it('confirms the order but leaves paymentStatus pending', async () => {
      ordersRepository.findByIdForCustomer.mockResolvedValue(deliveryOrder);
      ordersRepository.transition.mockResolvedValue({
        ...deliveryOrder,
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PENDING,
        paymentMethod: OrderPaymentMethod.CASH,
      });
      const result = await service.initializePayment(
        customerId,
        orderId,
        { provider: OrderPaymentMethodDtoEnum.CASH },
        context,
      );

      expect(ordersRepository.transition).toHaveBeenCalledWith(orderId, {
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PENDING,
        paymentMethod: OrderPaymentMethod.CASH,
        confirmedAt: expect.any(Date),
      });
      expect(inventoryDeduction.deductForOrder).toHaveBeenCalled();
      expect(walletService.debit).not.toHaveBeenCalled();
      expect(result.order.paymentStatus).toBe(PaymentStatus.PENDING);
    });

    it('rejects cash for pickup orders', async () => {
      ordersRepository.findByIdForCustomer.mockResolvedValue(sampleOrder);
      await expect(
        service.initializePayment(
          customerId,
          orderId,
          { provider: OrderPaymentMethodDtoEnum.CASH },
          context,
        ),
      ).rejects.toBeInstanceOf(ValidationDomainException);
    });
  });

  describe('markCashPaymentReceived', () => {
    it('settles a pending cash order', async () => {
      ordersRepository.findById.mockResolvedValue({
        ...sampleOrder,
        fulfillmentType: FulfillmentType.DELIVERY,
        paymentMethod: OrderPaymentMethod.CASH,
        paymentStatus: PaymentStatus.PENDING,
      });
      await service.markCashPaymentReceived(orderId, {});
      expect(ordersRepository.transition).toHaveBeenCalledWith(orderId, {
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PAID,
      });
    });

    it('is a no-op for orders not paid by cash', async () => {
      ordersRepository.findById.mockResolvedValue({
        ...sampleOrder,
        paymentMethod: OrderPaymentMethod.WALLET,
      });
      const result = await service.markCashPaymentReceived(orderId, {});
      expect(result).toBeNull();
      expect(ordersRepository.transition).not.toHaveBeenCalled();
    });

    it('is idempotent for an already-paid cash order', async () => {
      const paid = {
        ...sampleOrder,
        paymentMethod: OrderPaymentMethod.CASH,
        paymentStatus: PaymentStatus.PAID,
      };
      ordersRepository.findById.mockResolvedValue(paid);
      const result = await service.markCashPaymentReceived(orderId, {});
      expect(result).toBe(paid);
      expect(ordersRepository.transition).not.toHaveBeenCalled();
    });
  });

  describe('verifyPayment', () => {
    it('marks order paid, deducts inventory, archives cart on success', async () => {
      const result = await service.verifyPayment(customerId, orderId, {}, context);
      expect(result.success).toBe(true);
      expect(ordersRepository.transition).toHaveBeenCalledWith(orderId, {
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        confirmedAt: expect.any(Date),
      });
      expect(inventoryDeduction.deductForOrder).toHaveBeenCalled();
      expect(cartRepository.updateStatus).toHaveBeenCalledWith(cartId, CartStatus.CHECKED_OUT);
      expect(auditService.record).toHaveBeenCalledWith(
        PAYMENT_AUDIT_ACTIONS.VERIFIED,
        expect.any(Object),
        expect.any(Object),
      );
      expect(notifications.notifyPaymentResult).toHaveBeenCalled();
    });

    it('is idempotent for already successful transactions', async () => {
      paymentRepository.findLatestByOrderId.mockResolvedValue({
        ...sampleTxn,
        status: TransactionStatus.SUCCESS,
      });
      const result = await service.verifyPayment(customerId, orderId, {}, context);
      expect(result.alreadyProcessed).toBe(true);
      expect(provider.verifyPayment).not.toHaveBeenCalled();
    });

    it('marks failed without inventory deduction', async () => {
      provider.verifyPayment.mockResolvedValue({
        success: false,
        reference,
        status: 'failed',
      });
      const result = await service.verifyPayment(customerId, orderId, {}, context);
      expect(result.success).toBe(false);
      expect(paymentRepository.markFailed).toHaveBeenCalled();
      expect(inventoryDeduction.deductForOrder).not.toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        PAYMENT_AUDIT_ACTIONS.FAILED,
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('rejects missing transactions', async () => {
      paymentRepository.findLatestByOrderId.mockResolvedValue(null);
      await expect(service.verifyPayment(customerId, orderId, {}, context)).rejects.toBeInstanceOf(
        NotFoundDomainException,
      );
    });
  });

  describe('getPayment', () => {
    it('returns payment status for own order', async () => {
      const result = await service.getPayment(customerId, orderId);
      expect(result.orderId).toBe(orderId);
      expect(result.transaction?.providerReference).toBe(reference);
    });
  });

  describe('webhooks', () => {
    it('rejects invalid webhook signatures', async () => {
      provider.handleWebhook.mockResolvedValue({
        accepted: false,
        reason: 'Invalid Paystack signature',
      });
      await expect(
        service.handleWebhook(PaymentProvider.PAYSTACK, {
          rawBody: '{}',
          headers: {},
          payload: {},
        }),
      ).rejects.toBeInstanceOf(ValidationDomainException);
      expect(auditService.record).toHaveBeenCalledWith(
        PAYMENT_AUDIT_ACTIONS.WEBHOOK_REJECTED,
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('processes duplicate successful webhooks idempotently', async () => {
      paymentRepository.findByReference.mockResolvedValue({
        ...sampleTxn,
        status: TransactionStatus.SUCCESS,
      });
      ordersRepository.findById.mockResolvedValue({
        ...sampleOrder,
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
      });

      const result = await service.handleWebhook(PaymentProvider.PAYSTACK, {
        rawBody: '{}',
        headers: { 'x-paystack-signature': 'sig' },
        payload: { event: 'charge.success', data: { reference } },
      });

      expect(result.accepted).toBe(true);
      expect(auditService.record).toHaveBeenCalledWith(
        PAYMENT_AUDIT_ACTIONS.WEBHOOK_RECEIVED,
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('verifies with provider before confirming webhook success', async () => {
      await service.handleWebhook(PaymentProvider.PAYSTACK, {
        rawBody: '{}',
        headers: { 'x-paystack-signature': 'sig' },
        payload: { event: 'charge.success', data: { reference } },
      });
      expect(provider.verifyPayment).toHaveBeenCalledWith({ reference });
      expect(ordersRepository.transition).toHaveBeenCalledWith(
        orderId,
        expect.objectContaining({
          status: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PAID,
        }),
      );
    });

    // A reference this service does not own used to be logged and dropped.
    // Wallet top-ups, ride fares and utility purchases all keep their own
    // transaction rows, so dropping it meant a customer could be charged for
    // airtime that never arrived. It is now offered to their subscribers.
    it('hands an unknown reference to subscribers instead of dropping it', async () => {
      const eventBus = { emit: jest.fn().mockResolvedValue(undefined) };
      const withBus = new PaymentService(
        paymentRepository,
        ordersRepository,
        cartRepository,
        [provider],
        inventoryDeduction,
        auditService,
        notifications,
        prisma,
        config,
        walletService,
        eventBus as unknown as DomainEventBus,
      );
      paymentRepository.findByReference.mockResolvedValue(null);
      provider.handleWebhook.mockResolvedValue({
        accepted: true,
        event: 'charge.success',
        reference: 'UTIL-b3370710-1787109606020',
        success: true,
      });

      const result = await withBus.handleWebhook(PaymentProvider.PAYSTACK, {
        rawBody: '{}',
        headers: { 'x-paystack-signature': 'sig' },
        payload: {},
      });

      expect(result.accepted).toBe(true);
      expect(eventBus.emit).toHaveBeenCalledWith(
        DOMAIN_EVENTS.PAYMENT_WEBHOOK_UNMATCHED,
        expect.objectContaining({
          provider: PaymentProvider.PAYSTACK,
          reference: 'UTIL-b3370710-1787109606020',
          success: true,
        }),
      );
    });
  });
});

describe('PaystackProvider signatures', () => {
  const config = {
    paystackSecretKey: 'sk_test_secret',
    paystackBaseUrl: 'https://api.paystack.co',
  } as unknown as AppConfigService;

  const provider = new PaystackProvider(config);

  it('accepts valid HMAC signatures', async () => {
    const body = JSON.stringify({
      event: 'charge.success',
      data: { reference: 'ref-1', status: 'success', amount: 500000, id: 1 },
    });
    const signature = createHmac('sha512', 'sk_test_secret').update(body).digest('hex');
    const result = await provider.handleWebhook({
      rawBody: body,
      headers: { 'x-paystack-signature': signature },
      payload: JSON.parse(body) as unknown,
    });
    expect(result.accepted).toBe(true);
    expect(result.success).toBe(true);
  });

  it('rejects invalid signatures', async () => {
    const result = await provider.handleWebhook({
      rawBody: '{}',
      headers: { 'x-paystack-signature': 'bad' },
      payload: {},
    });
    expect(result.accepted).toBe(false);
  });
});

describe('FlutterwaveProvider signatures', () => {
  const config = {
    flutterwaveSecretKey: 'flw_secret',
    flutterwaveWebhookHash: 'whsec',
    flutterwaveBaseUrl: 'https://api.flutterwave.com',
  } as unknown as AppConfigService;

  const provider = new FlutterwaveProvider(config);

  it('accepts matching verif-hash', async () => {
    const result = await provider.handleWebhook({
      rawBody: '{}',
      headers: { 'verif-hash': 'whsec' },
      payload: {
        event: 'charge.completed',
        data: { tx_ref: 'ref-2', status: 'successful', amount: 5000, id: 2 },
      },
    });
    expect(result.accepted).toBe(true);
  });

  it('rejects bad verif-hash', async () => {
    const result = await provider.handleWebhook({
      rawBody: '{}',
      headers: { 'verif-hash': 'nope' },
      payload: {},
    });
    expect(result.accepted).toBe(false);
  });
});

describe('MoniepointProvider', () => {
  const provider = new MoniepointProvider();

  it('throws NotImplementedException for initialize', async () => {
    await expect(
      provider.initializePayment({
        email: 'a@b.com',
        amount: 1,
        currency: 'NGN',
        reference: 'r',
        orderId,
        orderNumber: 'o',
      }),
    ).rejects.toBeInstanceOf(NotImplementedException);
  });
});
