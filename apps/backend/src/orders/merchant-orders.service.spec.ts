import { FulfillmentType, OrderStatus, PaymentStatus, WalletOwnerType } from '@prisma/client';

import {
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { DOMAIN_EVENTS } from '../events/domain-events';

import { MerchantOrdersService } from './merchant-orders.service';
import { ORDER_AUDIT_ACTIONS, ORDER_WALLET_REFERENCE_TYPE } from './order.constants';

import type { AuditService } from '../audit/audit.service';
import type { DomainEventBus } from '../events/domain-event-bus';
import type { NotificationService } from '../notifications/notification.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { WalletService } from '../wallet/wallet.service';
import type { OrdersRepository, OrderWithItems } from './repositories/orders.repository';

const merchantId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const merchantProfileId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const customerId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const orderId = '11111111-1111-1111-1111-111111111111';

function makeOrder(overrides: Partial<OrderWithItems> = {}): OrderWithItems {
  return {
    id: orderId,
    customerId,
    merchantId: merchantProfileId,
    cartId: null,
    orderNumber: 'DPX-20260802-ABC123',
    status: OrderStatus.CONFIRMED,
    paymentStatus: PaymentStatus.PAID,
    fulfillmentType: FulfillmentType.DELIVERY,
    subtotal: 5000,
    discount: 0,
    tax: 0,
    deliveryFee: 0,
    total: 5000,
    couponCode: null,
    deliveryAddressId: null,
    notes: null,
    currency: 'NGN',
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
    ...overrides,
  } as unknown as OrderWithItems;
}

describe('MerchantOrdersService', () => {
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

  const auditService = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditService>;

  const notifications = {
    notifyOrderLifecycle: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<NotificationService>;

  const walletService = {
    refund: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<WalletService>;

  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ email: 'customer@example.com' }) },
    merchantProfile: { findUnique: jest.fn().mockResolvedValue({ id: merchantProfileId }) },
  } as unknown as PrismaService;

  const eventBus = {
    emit: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<DomainEventBus>;

  const service = new MerchantOrdersService(
    ordersRepository,
    auditService,
    notifications,
    walletService,
    prisma,
    eventBus,
  );

  const context = { userId: merchantId };

  beforeEach(() => {
    jest.clearAllMocks();
    ordersRepository.findByIdForMerchant.mockResolvedValue(makeOrder());
    ordersRepository.findById.mockResolvedValue(makeOrder());
    ordersRepository.transition.mockResolvedValue(makeOrder());
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ email: 'customer@example.com' });
    (prisma.merchantProfile.findUnique as jest.Mock).mockResolvedValue({ id: merchantProfileId });
  });

  it('rejects actions on orders belonging to another merchant', async () => {
    ordersRepository.findByIdForMerchant.mockResolvedValue(null);
    await expect(service.acceptOrder(merchantId, orderId, context)).rejects.toBeInstanceOf(
      NotFoundDomainException,
    );
  });

  it('rejects actions when the authenticated user has no merchant profile', async () => {
    (prisma.merchantProfile.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(service.acceptOrder(merchantId, orderId, context)).rejects.toBeInstanceOf(
      NotFoundDomainException,
    );
  });

  it("resolves the caller's MerchantProfile.id before checking order ownership", async () => {
    await service.getOrder(merchantId, orderId);
    expect(prisma.merchantProfile.findUnique).toHaveBeenCalledWith({
      where: { userId: merchantId },
    });
    expect(ordersRepository.findByIdForMerchant).toHaveBeenCalledWith(orderId, merchantProfileId);
  });

  describe('acceptOrder', () => {
    it('moves a confirmed order to preparing and notifies the customer', async () => {
      await service.acceptOrder(merchantId, orderId, context, '2026-08-02T18:00:00.000Z');

      expect(ordersRepository.transition).toHaveBeenCalledWith(orderId, {
        status: OrderStatus.PREPARING,
        estimatedReadyAt: new Date('2026-08-02T18:00:00.000Z'),
      });
      expect(auditService.record).toHaveBeenCalledWith(
        ORDER_AUDIT_ACTIONS.ACCEPTED,
        expect.any(Object),
        expect.any(Object),
      );
      expect(eventBus.emit).toHaveBeenCalledWith(
        DOMAIN_EVENTS.ORDER_ACCEPTED,
        expect.objectContaining({ orderId, merchantId }),
        expect.any(Object),
      );
      expect(notifications.notifyOrderLifecycle).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'order_accepted' }),
      );
    });

    it('rejects accepting an order that is not confirmed', async () => {
      ordersRepository.findByIdForMerchant.mockResolvedValue(
        makeOrder({ status: OrderStatus.PREPARING }),
      );
      await expect(service.acceptOrder(merchantId, orderId, context)).rejects.toBeInstanceOf(
        ValidationDomainException,
      );
    });
  });

  describe('rejectOrder', () => {
    it('refunds the wallet and cancels a paid confirmed order', async () => {
      await service.rejectOrder(merchantId, orderId, 'Out of stock', context);

      expect(walletService.refund).toHaveBeenCalledWith({
        ownerType: WalletOwnerType.CUSTOMER,
        ownerId: customerId,
        amount: 5000,
        referenceType: ORDER_WALLET_REFERENCE_TYPE,
        referenceId: orderId,
        description: expect.any(String),
        context: expect.objectContaining({ userId: merchantId }),
      });
      expect(ordersRepository.transition).toHaveBeenCalledWith(orderId, {
        status: OrderStatus.CANCELLED,
        cancelledAt: expect.any(Date),
        cancelledBy: 'MERCHANT',
        cancellationReason: 'Out of stock',
        paymentStatus: PaymentStatus.REFUNDED,
      });
      expect(notifications.notifyOrderLifecycle).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'order_rejected', reason: 'Out of stock' }),
      );
    });

    it('skips the wallet refund when the order was never paid', async () => {
      ordersRepository.findByIdForMerchant.mockResolvedValue(
        makeOrder({ paymentStatus: PaymentStatus.PENDING }),
      );

      await service.rejectOrder(merchantId, orderId, 'Out of stock', context);

      expect(walletService.refund).not.toHaveBeenCalled();
      expect(ordersRepository.transition).toHaveBeenCalledWith(orderId, {
        status: OrderStatus.CANCELLED,
        cancelledAt: expect.any(Date),
        cancelledBy: 'MERCHANT',
        cancellationReason: 'Out of stock',
      });
    });

    it('rejects rejecting an order that is not confirmed', async () => {
      ordersRepository.findByIdForMerchant.mockResolvedValue(
        makeOrder({ status: OrderStatus.READY }),
      );
      await expect(
        service.rejectOrder(merchantId, orderId, 'Too late', context),
      ).rejects.toBeInstanceOf(ValidationDomainException);
    });
  });

  describe('markReady', () => {
    it('moves a preparing order to ready and emits ORDER_READY with fulfillment type', async () => {
      ordersRepository.findByIdForMerchant.mockResolvedValue(
        makeOrder({ status: OrderStatus.PREPARING }),
      );

      await service.markReady(merchantId, orderId, context);

      expect(ordersRepository.transition).toHaveBeenCalledWith(orderId, {
        status: OrderStatus.READY,
        readyAt: expect.any(Date),
      });
      expect(eventBus.emit).toHaveBeenCalledWith(
        DOMAIN_EVENTS.ORDER_READY,
        expect.objectContaining({ orderId, fulfillmentType: FulfillmentType.DELIVERY }),
        expect.any(Object),
      );
    });

    it('rejects marking ready when not preparing', async () => {
      await expect(service.markReady(merchantId, orderId, context)).rejects.toBeInstanceOf(
        ValidationDomainException,
      );
    });
  });

  describe('delayOrder', () => {
    it('updates the estimated ready time and notifies', async () => {
      ordersRepository.findByIdForMerchant.mockResolvedValue(
        makeOrder({ status: OrderStatus.PREPARING }),
      );

      await service.delayOrder(
        merchantId,
        orderId,
        '2026-08-02T19:00:00.000Z',
        'Kitchen backlog',
        context,
      );

      expect(ordersRepository.transition).toHaveBeenCalledWith(orderId, {
        status: OrderStatus.PREPARING,
        estimatedReadyAt: new Date('2026-08-02T19:00:00.000Z'),
      });
      expect(notifications.notifyOrderLifecycle).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'order_delayed', reason: 'Kitchen backlog' }),
      );
    });
  });

  describe('cancelOrder', () => {
    it('refunds and cancels a ready order', async () => {
      ordersRepository.findByIdForMerchant.mockResolvedValue(
        makeOrder({ status: OrderStatus.READY }),
      );

      await service.cancelOrder(merchantId, orderId, 'Rider unavailable', context);

      expect(walletService.refund).toHaveBeenCalled();
      expect(ordersRepository.transition).toHaveBeenCalledWith(orderId, {
        status: OrderStatus.CANCELLED,
        cancelledAt: expect.any(Date),
        cancelledBy: 'MERCHANT',
        cancellationReason: 'Rider unavailable',
        paymentStatus: PaymentStatus.REFUNDED,
      });
    });

    it('rejects cancelling a delivered order', async () => {
      ordersRepository.findByIdForMerchant.mockResolvedValue(
        makeOrder({ status: OrderStatus.DELIVERED }),
      );
      await expect(
        service.cancelOrder(merchantId, orderId, undefined, context),
      ).rejects.toBeInstanceOf(ValidationDomainException);
    });
  });

  describe('listOrders / getOrder', () => {
    it('lists orders scoped to the merchant', async () => {
      ordersRepository.list.mockResolvedValue({ items: [makeOrder()], total: 1 });

      const result = await service.listOrders(merchantId, { page: 1, pageSize: 20 });

      expect(ordersRepository.list).toHaveBeenCalledWith(
        expect.objectContaining({ merchantId: merchantProfileId, skip: 0, take: 20 }),
      );
      expect(result.items).toHaveLength(1);
    });

    it('reads a single merchant-owned order', async () => {
      const result = await service.getOrder(merchantId, orderId);
      expect(result.id).toBe(orderId);
    });
  });
});
