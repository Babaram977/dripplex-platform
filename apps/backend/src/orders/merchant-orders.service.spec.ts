import {
  FulfillmentType,
  OrderPaymentMethod,
  OrderStatus,
  PaymentStatus,
  WalletOwnerType,
} from '@prisma/client';

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
    findStalledConfirmedOrders: jest.fn(),
    raiseStalledException: jest.fn(),
    resolveOpenExceptions: jest.fn(),
    findUnnotifiedOpenExceptions: jest.fn(),
    markExceptionNotified: jest.fn(),
    listExceptions: jest.fn(),
  };

  const auditService = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditService>;

  const notifications = {
    notifyOrderLifecycle: jest.fn().mockResolvedValue(undefined),
    notifyPaymentResult: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<NotificationService>;

  const walletService = {
    // WalletService.refund returns a WalletMutationOutcome — `applied` says
    // whether THIS call made the credit, and `ledgerId` is the evidence. The
    // default here is the ordinary case: a fresh credit.
    refund: jest.fn().mockResolvedValue({ wallet: {}, ledgerId: 'ledger-default', applied: true }),
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

    /**
     * DPX-ORDER-REFUND-TRUTH — the evidence the customer message is gated on.
     *
     * The in-app notification used to say "A refund has been issued." on every
     * rejection. These fix what the event is allowed to claim: the ledger entry
     * id is present only when THIS rejection created the credit.
     */
    it('ORJ-006 · emits the ledger entry id when this rejection made the credit', async () => {
      walletService.refund.mockResolvedValueOnce({
        wallet: {} as never,
        ledgerId: 'ledger-abc',
        applied: true,
      });

      await service.rejectOrder(merchantId, orderId, 'Out of stock', context);

      expect(eventBus.emit).toHaveBeenCalledWith(
        DOMAIN_EVENTS.ORDER_REJECTED,
        expect.objectContaining({ refundLedgerEntryId: 'ledger-abc' }),
        expect.anything(),
      );
    });

    it('ORJ-007 · emits NO ledger entry id for an order that was never paid', async () => {
      // THE DEFECT, at its source. A CASH order declined before delivery: no
      // money ever reached DrippleX, so nothing downstream may say a refund
      // was issued.
      ordersRepository.findByIdForMerchant.mockResolvedValue(
        makeOrder({ paymentStatus: PaymentStatus.PENDING }),
      );

      await service.rejectOrder(merchantId, orderId, 'Closed', context);

      expect(eventBus.emit).toHaveBeenCalledWith(
        DOMAIN_EVENTS.ORDER_REJECTED,
        expect.objectContaining({ refundLedgerEntryId: null }),
        expect.anything(),
      );
    });

    it('ORJ-008 · emits NO ledger entry id when the credit was already there', async () => {
      // `applied: false` is a replay: the ledger already held this exact credit.
      // The money is back, but this rejection did not put it there, so claiming
      // it would announce somebody else's refund a second time.
      walletService.refund.mockResolvedValueOnce({
        wallet: {} as never,
        ledgerId: 'ledger-existing',
        applied: false,
      });

      await service.rejectOrder(merchantId, orderId, 'Duplicate', context);

      expect(eventBus.emit).toHaveBeenCalledWith(
        DOMAIN_EVENTS.ORDER_REJECTED,
        expect.objectContaining({ refundLedgerEntryId: null }),
        expect.anything(),
      );
    });

    it('ORJ-009 · a replay still leaves the order REFUNDED — the money IS back', async () => {
      // The distinction that matters: payment STATE and what may be CLAIMED are
      // two different questions. A replay means the credit exists, so REFUNDED
      // is correct; it is only the customer-facing claim that is withheld.
      walletService.refund.mockResolvedValueOnce({
        wallet: {} as never,
        ledgerId: 'ledger-existing',
        applied: false,
      });

      await service.rejectOrder(merchantId, orderId, 'Duplicate', context);

      expect(ordersRepository.transition).toHaveBeenCalledWith(
        orderId,
        expect.objectContaining({ paymentStatus: PaymentStatus.REFUNDED }),
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

    it('ORJ-010 · does NOT mark an unpaid cancelled order as refunded', async () => {
      // Found by mutation testing, not by review: `refundIfPaid` returns an
      // OBJECT now, and an object is always truthy. Reading it directly instead
      // of `.paymentRefunded` compiles cleanly, passes every other test here,
      // and marks a CASH order REFUNDED that nobody ever paid — a false
      // financial state on the authoritative order record.
      //
      // No test covered cancelling an unpaid order at all, so the mutation
      // reddened nothing. This is that test.
      ordersRepository.findByIdForMerchant.mockResolvedValue(
        makeOrder({ status: OrderStatus.READY, paymentStatus: PaymentStatus.PENDING }),
      );

      await service.cancelOrder(merchantId, orderId, 'Rider unavailable', context);

      expect(walletService.refund).not.toHaveBeenCalled();
      expect(ordersRepository.transition).toHaveBeenCalledWith(orderId, {
        status: OrderStatus.CANCELLED,
        cancelledAt: expect.any(Date),
        cancelledBy: 'MERCHANT',
        cancellationReason: 'Rider unavailable',
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

  /**
   * DPX-ORDER-B — "Pay to Merchant Bank" money lands in the MERCHANT's account,
   * so only they can confirm it. Until this existed a MERCHANT_DIRECT order
   * could never become PAID, which stranded a real order: the merchant marked
   * it READY, createDeliveryJob refused an unpaid non-cash order, the failure
   * was swallowed into a log line, and the customer watched "Pending rider"
   * with no delivery job in existence.
   */
  describe('confirmPaymentReceived', () => {
    const bankTransferOrder = (overrides: Partial<OrderWithItems> = {}): OrderWithItems =>
      makeOrder({
        paymentMethod: OrderPaymentMethod.MERCHANT_DIRECT,
        paymentStatus: PaymentStatus.PENDING,
        ...overrides,
      });

    it('marks a bank-transfer order paid without touching its lifecycle status', async () => {
      ordersRepository.findByIdForMerchant.mockResolvedValue(
        bankTransferOrder({ status: OrderStatus.PREPARING }),
      );

      await service.confirmPaymentReceived(merchantId, orderId, context);

      expect(ordersRepository.transition).toHaveBeenCalledWith(orderId, {
        status: OrderStatus.PREPARING,
        paymentStatus: PaymentStatus.PAID,
      });
      expect(auditService.record).toHaveBeenCalledWith(
        ORDER_AUDIT_ACTIONS.PAYMENT_CONFIRMED,
        expect.objectContaining({ userId: merchantId }),
        expect.objectContaining({ resource: 'order', resourceId: orderId }),
      );
      expect(eventBus.emit).toHaveBeenCalledWith(
        DOMAIN_EVENTS.ORDER_PAID,
        expect.objectContaining({ orderId, method: OrderPaymentMethod.MERCHANT_DIRECT }),
        expect.anything(),
      );
    });

    it('dispatches the delivery for an order already marked ready — the stranded case', async () => {
      ordersRepository.findByIdForMerchant.mockResolvedValue(
        bankTransferOrder({ status: OrderStatus.READY }),
      );

      await service.confirmPaymentReceived(merchantId, orderId, context);

      // Re-emitting ORDER_READY is what rescues the order: dispatch refused it
      // the first time only because payment had not landed.
      expect(eventBus.emit).toHaveBeenCalledWith(
        DOMAIN_EVENTS.ORDER_READY,
        expect.objectContaining({ orderId, fulfillmentType: FulfillmentType.DELIVERY }),
        expect.anything(),
      );
    });

    it('does not ask for dispatch when the order is not ready yet', async () => {
      ordersRepository.findByIdForMerchant.mockResolvedValue(
        bankTransferOrder({ status: OrderStatus.CONFIRMED }),
      );

      await service.confirmPaymentReceived(merchantId, orderId, context);

      const readyEmits = eventBus.emit.mock.calls.filter(
        ([event]) => event === DOMAIN_EVENTS.ORDER_READY,
      );
      expect(readyEmits).toHaveLength(0);
    });

    it('tells the customer their payment was confirmed', async () => {
      ordersRepository.findByIdForMerchant.mockResolvedValue(bankTransferOrder());

      await service.confirmPaymentReceived(merchantId, orderId, context);

      expect(notifications.notifyPaymentResult).toHaveBeenCalledWith(
        expect.objectContaining({ audience: 'customer', success: true, orderId }),
      );
    });

    it('is idempotent — a second confirmation changes nothing', async () => {
      ordersRepository.findByIdForMerchant.mockResolvedValue(
        bankTransferOrder({ paymentStatus: PaymentStatus.PAID }),
      );

      await service.confirmPaymentReceived(merchantId, orderId, context);

      expect(ordersRepository.transition).not.toHaveBeenCalled();
      expect(eventBus.emit).not.toHaveBeenCalled();
    });

    it("refuses any other payment method — wallet and card are already paid, cash is the rider's", async () => {
      ordersRepository.findByIdForMerchant.mockResolvedValue(
        makeOrder({
          paymentMethod: OrderPaymentMethod.CASH,
          paymentStatus: PaymentStatus.PENDING,
        }),
      );

      await expect(
        service.confirmPaymentReceived(merchantId, orderId, context),
      ).rejects.toBeInstanceOf(ValidationDomainException);
      expect(ordersRepository.transition).not.toHaveBeenCalled();
    });

    it('refuses an order belonging to another merchant', async () => {
      ordersRepository.findByIdForMerchant.mockResolvedValue(null);

      await expect(
        service.confirmPaymentReceived(merchantId, orderId, context),
      ).rejects.toBeInstanceOf(NotFoundDomainException);
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
