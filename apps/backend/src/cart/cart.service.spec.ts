import { CartStatus, MerchantStatus } from '@prisma/client';

import {
  CartMerchantConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';

import { CART_AUDIT_ACTIONS } from './cart.constants';
import { CartService } from './cart.service';

import type { AuditService } from '../audit/audit.service';
import type { InventoryValidator } from './inventory/inventory-validator';
import type { CouponEngine } from './pricing/coupon-engine';
import type { DeliveryFeeCalculator } from './pricing/delivery-fee-calculator';
import type { TaxCalculator } from './pricing/tax-calculator';
import type { CartRepository, CartWithItems } from './repositories/cart.repository';
import type { PrismaService } from '../prisma/prisma.service';
import type { CartItem } from '@prisma/client';

const customerId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const merchantId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const otherMerchantId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const cartId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const itemId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const productId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

const sampleItem = {
  id: itemId,
  cartId,
  productId,
  variantId: null,
  productNameSnapshot: 'Jollof Rice',
  skuSnapshot: 'JR-001',
  imageSnapshot: null,
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
  tax: 375,
  deliveryFee: 1500,
  total: 6875,
  status: CartStatus.ACTIVE,
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [sampleItem],
} as unknown as CartWithItems;

const addDto = {
  merchantId,
  productId,
  productName: 'Jollof Rice',
  sku: 'JR-001',
  unitPrice: 2500,
  quantity: 1,
};

describe('CartService', () => {
  const repository: jest.Mocked<CartRepository> = {
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

  const couponEngine: jest.Mocked<CouponEngine> = {
    applyDiscount: jest.fn().mockResolvedValue(0),
  };

  const taxCalculator: jest.Mocked<TaxCalculator> = {
    calculateTax: jest.fn().mockResolvedValue(375),
  };

  const deliveryFeeCalculator: jest.Mocked<DeliveryFeeCalculator> = {
    calculateFee: jest.fn().mockResolvedValue(1500),
  };

  const inventoryValidator: jest.Mocked<InventoryValidator> = {
    validateAvailability: jest.fn().mockResolvedValue({ available: true }),
  };

  const auditService = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditService>;

  const prisma = {
    merchantProfile: {
      findFirst: jest.fn().mockResolvedValue({
        userId: merchantId,
        status: MerchantStatus.APPROVED,
        deletedAt: null,
      }),
    },
  } as unknown as PrismaService;

  const service = new CartService(
    repository,
    couponEngine,
    taxCalculator,
    deliveryFeeCalculator,
    inventoryValidator,
    auditService,
    prisma,
  );

  const context = { userId: customerId };

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findLockedByCustomerId.mockResolvedValue(null);
    repository.findOpenByCustomerId.mockResolvedValue(null);
    (prisma.merchantProfile.findFirst as jest.Mock).mockResolvedValue({
      userId: merchantId,
      status: MerchantStatus.APPROVED,
      deletedAt: null,
    });
    inventoryValidator.validateAvailability.mockResolvedValue({ available: true });
    couponEngine.applyDiscount.mockResolvedValue(0);
    taxCalculator.calculateTax.mockResolvedValue(375);
    deliveryFeeCalculator.calculateFee.mockResolvedValue(1500);
  });

  describe('create / add item', () => {
    it('creates a cart when none exists', async () => {
      repository.findActiveByCustomerId.mockResolvedValue(null);
      repository.createCart.mockResolvedValue({ ...sampleCart, items: [] });
      repository.findDuplicateItem.mockResolvedValue(null);
      repository.addItem.mockResolvedValue(sampleItem);
      repository.findById.mockResolvedValue(sampleCart);
      repository.updateTotals.mockResolvedValue(sampleCart);

      const result = await service.addItem(customerId, addDto, context);

      expect(repository.createCart).toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        CART_AUDIT_ACTIONS.CREATED,
        expect.any(Object),
        expect.any(Object),
      );
      expect(result.merchantId).toBe(merchantId);
    });

    it('rejects merchant conflict with CART_MERCHANT_CONFLICT', async () => {
      repository.findActiveByCustomerId.mockResolvedValue(sampleCart);

      await expect(
        service.addItem(customerId, { ...addDto, merchantId: otherMerchantId }, context),
      ).rejects.toBeInstanceOf(CartMerchantConflictDomainException);

      try {
        await service.addItem(customerId, { ...addDto, merchantId: otherMerchantId }, context);
      } catch (error) {
        expect((error as CartMerchantConflictDomainException).errorCode).toBe(
          'CART_MERCHANT_CONFLICT',
        );
        expect((error as CartMerchantConflictDomainException).statusCode).toBe(409);
      }
    });

    it('merges duplicate product/variant quantities', async () => {
      repository.findActiveByCustomerId.mockResolvedValue(sampleCart);
      repository.findDuplicateItem.mockResolvedValue(sampleItem);
      repository.updateItem.mockResolvedValue({
        ...sampleItem,
        quantity: 3,
        subtotal: 7500,
      } as unknown as CartItem);
      repository.findById.mockResolvedValue({
        ...sampleCart,
        items: [{ ...sampleItem, quantity: 3, subtotal: 7500 } as unknown as CartItem],
      });
      repository.updateTotals.mockResolvedValue(sampleCart);

      await service.addItem(customerId, addDto, context);

      expect(repository.updateItem).toHaveBeenCalledWith(
        itemId,
        expect.objectContaining({ quantity: 3 }),
      );
      expect(repository.addItem).not.toHaveBeenCalled();
    });
  });

  describe('update / remove / clear', () => {
    it('updates item quantity using snapshot unit price', async () => {
      repository.findActiveByCustomerId.mockResolvedValue(sampleCart);
      repository.updateItem.mockResolvedValue({
        ...sampleItem,
        quantity: 4,
        subtotal: 10000,
      } as unknown as CartItem);
      repository.findById.mockResolvedValue(sampleCart);
      repository.updateTotals.mockResolvedValue(sampleCart);

      await service.updateItem(customerId, itemId, { quantity: 4 }, context);

      expect(repository.updateItem).toHaveBeenCalledWith(
        itemId,
        expect.objectContaining({ quantity: 4, subtotal: 10000 }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        CART_AUDIT_ACTIONS.ITEM_UPDATED,
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('removes an item and recalculates', async () => {
      const secondItem = { ...sampleItem, id: '11111111-1111-1111-1111-111111111111' };
      repository.findActiveByCustomerId.mockResolvedValue({
        ...sampleCart,
        items: [sampleItem, secondItem],
      });
      repository.findById
        .mockResolvedValueOnce({
          ...sampleCart,
          items: [secondItem],
        })
        .mockResolvedValue(sampleCart);
      repository.updateTotals.mockResolvedValue(sampleCart);

      await service.removeItem(customerId, itemId, context);

      expect(repository.removeItem).toHaveBeenCalledWith(itemId);
      expect(auditService.record).toHaveBeenCalledWith(
        CART_AUDIT_ACTIONS.ITEM_REMOVED,
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('clears cart and marks abandoned', async () => {
      repository.findActiveByCustomerId.mockResolvedValue(sampleCart);
      repository.clearItems.mockResolvedValue(undefined);
      repository.updateTotals.mockResolvedValue(sampleCart);
      repository.updateStatus.mockResolvedValue({
        ...sampleCart,
        status: CartStatus.ABANDONED,
      });

      const result = await service.clearCart(customerId, context);

      expect(result.cleared).toBe(true);
      expect(repository.updateStatus).toHaveBeenCalledWith(cartId, CartStatus.ABANDONED);
      expect(auditService.record).toHaveBeenCalledWith(
        CART_AUDIT_ACTIONS.CLEARED,
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('totals and eligibility', () => {
    it('recalculates totals via pricing hooks', async () => {
      repository.findActiveByCustomerId.mockResolvedValue(sampleCart);
      repository.findById.mockResolvedValue(sampleCart);
      repository.updateTotals.mockResolvedValue(sampleCart);

      const result = await service.recalculate(customerId, context);

      expect(couponEngine.applyDiscount).toHaveBeenCalled();
      expect(taxCalculator.calculateTax).toHaveBeenCalledWith(
        expect.objectContaining({ subtotal: 5000, discount: 0 }),
      );
      expect(deliveryFeeCalculator.calculateFee).toHaveBeenCalled();
      expect(repository.updateTotals).toHaveBeenCalledWith(
        cartId,
        expect.objectContaining({
          subtotal: 5000,
          discount: 0,
          tax: 375,
          deliveryFee: 1500,
          total: 6875,
        }),
      );
      expect(result.totals.total).toBe(6875);
      expect(auditService.record).toHaveBeenCalledWith(
        CART_AUDIT_ACTIONS.RECALCULATED,
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('rejects mutations when cart is locked', async () => {
      repository.findLockedByCustomerId.mockResolvedValue({
        ...sampleCart,
        status: CartStatus.LOCKED,
      });
      await expect(service.addItem(customerId, addDto, context)).rejects.toBeInstanceOf(
        ValidationDomainException,
      );
    });

    it('reports checkout eligibility', async () => {
      repository.findActiveByCustomerId.mockResolvedValue(sampleCart);
      const result = await service.getCheckoutEligibility(customerId);
      expect(result.eligible).toBe(true);
    });

    it('rejects unavailable inventory', async () => {
      inventoryValidator.validateAvailability.mockResolvedValue({
        available: false,
        reason: 'Out of stock',
      });
      repository.findActiveByCustomerId.mockResolvedValue(null);

      await expect(service.addItem(customerId, addDto, context)).rejects.toBeInstanceOf(
        ValidationDomainException,
      );
    });

    it('rejects unknown merchant', async () => {
      (prisma.merchantProfile.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.addItem(customerId, addDto, context)).rejects.toBeInstanceOf(
        NotFoundDomainException,
      );
    });
  });
});
