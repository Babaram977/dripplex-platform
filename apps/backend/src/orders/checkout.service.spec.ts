import {
  CartStatus,
  FulfillmentType,
  MerchantStatus,
  OrderStatus,
  PaymentStatus,
  UserStatus,
} from '@prisma/client';

import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';

import { CheckoutService } from './checkout.service';
import { CheckoutFulfillmentType } from './dto/order.dto';
import { ORDER_AUDIT_ACTIONS } from './order.constants';
import { ReservationCleanupService } from './reservation-cleanup.service';

import type { AddressRepository } from '../addresses/repositories/address.repository';
import type { AuditService } from '../audit/audit.service';
import type { CartRepository, CartWithItems } from '../cart/repositories/cart.repository';
import type { NotificationService } from '../notifications/notification.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { CheckoutInventoryValidator } from './inventory/checkout-inventory.validator';
import type { InventoryReservationService } from './inventory/inventory-reservation.service';
import type { CheckoutProductValidator } from './pricing/checkout-product.validator';
import type { CouponCalculator } from './pricing/coupon-calculator';
import type { DeliveryCalculator } from './pricing/delivery-calculator';
import type { TaxCalculator } from './pricing/tax-calculator';
import type { OrdersRepository, OrderWithItems } from './repositories/orders.repository';
import type { CartItem } from '@prisma/client';

const customerId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const merchantId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const cartId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const orderId = '11111111-1111-1111-1111-111111111111';
const productId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const addressId = '22222222-2222-2222-2222-222222222222';
const itemId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

const sampleItem = {
  id: itemId,
  cartId,
  productId,
  variantId: null,
  productNameSnapshot: 'Jollof Rice',
  skuSnapshot: 'JR-001',
  imageSnapshot: 'https://cdn.example/jollof.jpg',
  unitPriceSnapshot: 2500,
  quantity: 2,
  subtotal: 5000,
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as CartItem;

const sampleCart = {
  id: cartId,
  customerId,
  merchantId,
  currency: 'NGN',
  subtotal: 5000,
  discount: 0,
  tax: 0,
  deliveryFee: 0,
  total: 5000,
  status: CartStatus.ACTIVE,
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [sampleItem],
} as unknown as CartWithItems;

const sampleOrder = {
  id: orderId,
  customerId,
  merchantId,
  cartId,
  orderNumber: 'DPX-20260721-ABC123',
  status: OrderStatus.PENDING_PAYMENT,
  paymentStatus: PaymentStatus.PENDING,
  fulfillmentType: FulfillmentType.DELIVERY,
  subtotal: 5000,
  discount: 0,
  tax: 0,
  deliveryFee: 0,
  total: 5000,
  couponCode: null,
  deliveryAddressId: addressId,
  notes: null,
  currency: 'NGN',
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [
    {
      id: '33333333-3333-3333-3333-333333333333',
      orderId,
      productId,
      variantId: null,
      merchantId,
      quantity: 2,
      unitPrice: 2500,
      subtotal: 5000,
      snapshotName: 'Jollof Rice',
      snapshotImage: 'https://cdn.example/jollof.jpg',
      snapshotSku: 'JR-001',
      createdAt: new Date(),
    },
  ],
  reservations: [
    {
      id: '44444444-4444-4444-4444-444444444444',
      orderId,
      productId,
      variantId: null,
      quantity: 2,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      releasedAt: null,
      createdAt: new Date(),
    },
  ],
} as unknown as OrderWithItems;

describe('CheckoutService', () => {
  const ordersRepository: jest.Mocked<OrdersRepository> = {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdForCustomer: jest.fn(),
    list: jest.fn(),
    cancelOrder: jest.fn(),
    markFailed: jest.fn(),
    findByCartId: jest.fn(),
    createReservations: jest.fn(),
    releaseReservationsForOrder: jest.fn(),
    findExpiredActiveReservations: jest.fn(),
    findUnpaidOrdersWithExpiredReservations: jest.fn(),
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

  const addressRepository: jest.Mocked<AddressRepository> = {
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    findById: jest.fn(),
    findByIdForCustomer: jest.fn(),
    listByCustomerId: jest.fn(),
    countByCustomerId: jest.fn(),
    findDefault: jest.fn(),
    setDefault: jest.fn(),
  };

  const productValidator: jest.Mocked<CheckoutProductValidator> = {
    resolve: jest.fn(),
  };

  const inventoryValidator: jest.Mocked<CheckoutInventoryValidator> = {
    assertAvailable: jest.fn(),
  };

  const taxCalculator: jest.Mocked<TaxCalculator> = {
    calculate: jest.fn().mockResolvedValue(0),
  };

  const deliveryCalculator: jest.Mocked<DeliveryCalculator> = {
    calculate: jest.fn().mockResolvedValue(0),
  };

  const couponCalculator: jest.Mocked<CouponCalculator> = {
    calculate: jest.fn().mockResolvedValue({ discount: 0, couponCode: null }),
  };

  const reservationService = {
    reserve: jest.fn().mockResolvedValue(undefined),
    releaseForOrder: jest.fn().mockResolvedValue(1),
    releaseExpired: jest.fn().mockResolvedValue(0),
  } as unknown as jest.Mocked<InventoryReservationService>;

  const auditService = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditService>;

  const notifications = {
    notifyOrderCreated: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<NotificationService>;

  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    merchantProfile: {
      findFirst: jest.fn(),
    },
  } as unknown as PrismaService;

  const service = new CheckoutService(
    ordersRepository,
    cartRepository,
    addressRepository,
    productValidator,
    inventoryValidator,
    taxCalculator,
    deliveryCalculator,
    couponCalculator,
    reservationService,
    auditService,
    notifications,
    prisma,
  );

  const context = { userId: customerId, ipAddress: '127.0.0.1' };

  beforeEach(() => {
    jest.clearAllMocks();
    cartRepository.findLockedByCustomerId.mockResolvedValue(null);
    cartRepository.findActiveByCustomerId.mockResolvedValue(sampleCart);
    cartRepository.findByIdForCustomer.mockResolvedValue(sampleCart);
    cartRepository.updateStatus.mockResolvedValue({
      ...sampleCart,
      status: CartStatus.LOCKED,
    });
    addressRepository.findDefault.mockResolvedValue({
      id: addressId,
      customerId,
      isActive: true,
    } as never);
    addressRepository.findByIdForCustomer.mockResolvedValue({
      id: addressId,
      customerId,
      isActive: true,
    } as never);
    productValidator.resolve.mockResolvedValue([
      {
        productId,
        variantId: null,
        merchantId,
        name: 'Jollof Rice',
        sku: 'JR-001',
        imageUrl: 'https://cdn.example/jollof.jpg',
        unitPrice: 2500,
        active: true,
        deleted: false,
      },
    ]);
    inventoryValidator.assertAvailable.mockResolvedValue(undefined);
    taxCalculator.calculate.mockResolvedValue(0);
    deliveryCalculator.calculate.mockResolvedValue(0);
    couponCalculator.calculate.mockResolvedValue({ discount: 0, couponCode: null });
    ordersRepository.create.mockResolvedValue(sampleOrder);
    ordersRepository.findById.mockResolvedValue(sampleOrder);
    ordersRepository.findByIdForCustomer.mockResolvedValue(sampleOrder);
    ordersRepository.list.mockResolvedValue({ items: [sampleOrder], total: 1 });
    ordersRepository.cancelOrder.mockResolvedValue({
      ...sampleOrder,
      status: OrderStatus.CANCELLED,
    });
    (prisma.user.findUnique as jest.Mock).mockImplementation(
      ({ where }: { where: { id: string } }) => {
        if (where.id === customerId) {
          return Promise.resolve({
            id: customerId,
            email: 'customer@example.com',
            status: UserStatus.ACTIVE,
            emailVerifiedAt: new Date(),
            deletedAt: null,
          });
        }
        return Promise.resolve({
          id: merchantId,
          email: 'merchant@example.com',
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
          deletedAt: null,
        });
      },
    );
    (prisma.merchantProfile.findFirst as jest.Mock).mockResolvedValue({
      userId: merchantId,
      status: MerchantStatus.APPROVED,
      deletedAt: null,
    });
  });

  describe('checkout', () => {
    it('creates an order with snapshots, reservations, and locks the cart', async () => {
      const result = await service.checkout(
        customerId,
        { fulfillmentType: CheckoutFulfillmentType.DELIVERY },
        context,
      );

      expect(result.order.id).toBe(orderId);
      expect(result.order.total).toBe(5000);
      expect(result.order.items[0]?.snapshotName).toBe('Jollof Rice');
      expect(ordersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId,
          merchantId,
          cartId,
          subtotal: 5000,
          discount: 0,
          tax: 0,
          deliveryFee: 0,
          total: 5000,
          items: [
            expect.objectContaining({
              snapshotName: 'Jollof Rice',
              snapshotSku: 'JR-001',
              unitPrice: 2500,
              quantity: 2,
            }),
          ],
        }),
      );
      expect(reservationService.reserve).toHaveBeenCalledWith(expect.objectContaining({ orderId }));
      expect(cartRepository.updateStatus).toHaveBeenCalledWith(cartId, CartStatus.LOCKED);
      expect(auditService.record).toHaveBeenCalledWith(
        ORDER_AUDIT_ACTIONS.CREATED,
        expect.any(Object),
        expect.objectContaining({ resourceId: orderId }),
      );
      expect(notifications.notifyOrderCreated).toHaveBeenCalledTimes(2);
    });

    it('rejects empty carts', async () => {
      cartRepository.findActiveByCustomerId.mockResolvedValue({
        ...sampleCart,
        items: [],
      });
      await expect(service.checkout(customerId, {}, context)).rejects.toBeInstanceOf(
        ValidationDomainException,
      );
    });

    it('rejects locked carts', async () => {
      cartRepository.findLockedByCustomerId.mockResolvedValue({
        ...sampleCart,
        status: CartStatus.LOCKED,
      });
      await expect(service.checkout(customerId, {}, context)).rejects.toBeInstanceOf(
        ConflictDomainException,
      );
    });

    it('rejects inactive merchants', async () => {
      (prisma.merchantProfile.findFirst as jest.Mock).mockResolvedValue({
        userId: merchantId,
        status: MerchantStatus.UNDER_REVIEW,
        deletedAt: null,
      });
      await expect(service.checkout(customerId, {}, context)).rejects.toBeInstanceOf(
        ValidationDomainException,
      );
    });

    it('rejects unavailable inventory', async () => {
      inventoryValidator.assertAvailable.mockRejectedValue(
        new ValidationDomainException('Out of stock'),
      );
      await expect(service.checkout(customerId, {}, context)).rejects.toBeInstanceOf(
        ValidationDomainException,
      );
    });

    it('rejects inactive products', async () => {
      productValidator.resolve.mockResolvedValue([
        {
          productId,
          variantId: null,
          merchantId,
          name: 'Jollof Rice',
          sku: 'JR-001',
          imageUrl: null,
          unitPrice: 2500,
          active: false,
          deleted: false,
        },
      ]);
      await expect(service.checkout(customerId, {}, context)).rejects.toBeInstanceOf(
        ValidationDomainException,
      );
    });

    it('rejects deleted products', async () => {
      productValidator.resolve.mockResolvedValue([
        {
          productId,
          variantId: null,
          merchantId,
          name: 'Jollof Rice',
          sku: 'JR-001',
          imageUrl: null,
          unitPrice: 2500,
          active: true,
          deleted: true,
        },
      ]);
      await expect(service.checkout(customerId, {}, context)).rejects.toBeInstanceOf(
        ValidationDomainException,
      );
    });

    it('rejects invalid delivery addresses', async () => {
      addressRepository.findDefault.mockResolvedValue(null);
      addressRepository.findByIdForCustomer.mockResolvedValue(null);
      await expect(
        service.checkout(customerId, { deliveryAddressId: addressId }, context),
      ).rejects.toBeInstanceOf(ValidationDomainException);
    });

    it('rejects unverified customers', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: customerId,
        email: 'customer@example.com',
        status: UserStatus.PENDING_VERIFICATION,
        emailVerifiedAt: null,
        deletedAt: null,
      });
      await expect(service.checkout(customerId, {}, context)).rejects.toBeInstanceOf(
        ValidationDomainException,
      );
    });

    it('computes zero default tax/discount/delivery totals', async () => {
      await service.checkout(customerId, { couponCode: 'SAVE10' }, context);
      expect(couponCalculator.calculate).toHaveBeenCalled();
      expect(taxCalculator.calculate).toHaveBeenCalled();
      expect(deliveryCalculator.calculate).toHaveBeenCalled();
      expect(ordersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ tax: 0, discount: 0, deliveryFee: 0, total: 5000 }),
      );
    });

    it('allows pickup without delivery address', async () => {
      await service.checkout(
        customerId,
        { fulfillmentType: CheckoutFulfillmentType.PICKUP },
        context,
      );
      expect(ordersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fulfillmentType: FulfillmentType.PICKUP,
          deliveryAddressId: null,
        }),
      );
    });
  });

  describe('customer orders', () => {
    it('lists orders newest first with pagination meta', async () => {
      const result = await service.listCustomerOrders(customerId, 1, 20);
      expect(result.items).toHaveLength(1);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
      expect(ordersRepository.list).toHaveBeenCalledWith(
        expect.objectContaining({ customerId, skip: 0, take: 20 }),
      );
    });

    it('returns own order details', async () => {
      const result = await service.getCustomerOrder(customerId, orderId);
      expect(result.id).toBe(orderId);
    });

    it('hides other customers orders', async () => {
      ordersRepository.findByIdForCustomer.mockResolvedValue(null);
      await expect(service.getCustomerOrder(customerId, orderId)).rejects.toBeInstanceOf(
        NotFoundDomainException,
      );
    });

    it('cancels pending payment orders and releases inventory', async () => {
      cartRepository.findById.mockResolvedValue({
        ...sampleCart,
        status: CartStatus.LOCKED,
      });
      ordersRepository.findById.mockResolvedValue({
        ...sampleOrder,
        status: OrderStatus.CANCELLED,
      });

      const result = await service.cancelCustomerOrder(
        customerId,
        orderId,
        context,
        'changed mind',
      );

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(reservationService.releaseForOrder).toHaveBeenCalled();
      expect(cartRepository.updateStatus).toHaveBeenCalledWith(cartId, CartStatus.ACTIVE);
      expect(auditService.record).toHaveBeenCalledWith(
        ORDER_AUDIT_ACTIONS.CANCELLED,
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('rejects cancel when not pending payment', async () => {
      ordersRepository.findByIdForCustomer.mockResolvedValue({
        ...sampleOrder,
        status: OrderStatus.PAID,
      });
      await expect(
        service.cancelCustomerOrder(customerId, orderId, context),
      ).rejects.toBeInstanceOf(ValidationDomainException);
    });
  });

  describe('admin orders', () => {
    it('filters by status merchant customer payment and date', async () => {
      await service.listAdminOrders({
        status: 'PENDING_PAYMENT',
        paymentStatus: 'PENDING',
        merchantId,
        customerId,
        createdFrom: '2026-07-01T00:00:00.000Z',
        createdTo: '2026-07-31T23:59:59.000Z',
        page: 2,
        pageSize: 10,
      });

      expect(ordersRepository.list).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'PENDING_PAYMENT',
          paymentStatus: 'PENDING',
          merchantId,
          customerId,
          skip: 10,
          take: 10,
        }),
      );
    });

    it('reads any order by id', async () => {
      const result = await service.getAdminOrder(orderId);
      expect(result.orderNumber).toBe('DPX-20260721-ABC123');
    });
  });
});

describe('ReservationCleanupService', () => {
  const ordersRepository: jest.Mocked<OrdersRepository> = {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdForCustomer: jest.fn(),
    list: jest.fn(),
    cancelOrder: jest.fn(),
    markFailed: jest.fn(),
    findByCartId: jest.fn(),
    createReservations: jest.fn(),
    releaseReservationsForOrder: jest.fn(),
    findExpiredActiveReservations: jest.fn(),
    findUnpaidOrdersWithExpiredReservations: jest.fn(),
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

  const reservationService = {
    releaseExpired: jest.fn().mockResolvedValue(2),
  } as unknown as jest.Mocked<InventoryReservationService>;

  const cleanup = new ReservationCleanupService(
    ordersRepository,
    cartRepository,
    reservationService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fails unpaid expired orders, unlocks carts, and releases reservations', async () => {
    ordersRepository.findUnpaidOrdersWithExpiredReservations.mockResolvedValue([sampleOrder]);
    cartRepository.findById.mockResolvedValue({
      ...sampleCart,
      status: CartStatus.LOCKED,
    });
    ordersRepository.markFailed.mockResolvedValue({
      ...sampleOrder,
      status: OrderStatus.FAILED,
      paymentStatus: PaymentStatus.FAILED,
    });

    const result = await cleanup.runCleanup();

    expect(ordersRepository.markFailed).toHaveBeenCalledWith(orderId);
    expect(cartRepository.updateStatus).toHaveBeenCalledWith(cartId, CartStatus.ACTIVE);
    expect(reservationService.releaseExpired).toHaveBeenCalled();
    expect(result.failedOrders).toBe(1);
    expect(result.unlockedCarts).toBe(1);
    expect(result.releasedReservations).toBe(2);
  });
});
