import { CartStatus } from '@prisma/client';

import { PrismaCartRepository } from './prisma-cart.repository';

import type { PrismaService } from '../../prisma/prisma.service';

describe('PrismaCartRepository', () => {
  const cart = {
    id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    customerId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    merchantId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    status: CartStatus.ACTIVE,
    items: [],
  };

  const prisma = {
    cart: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    cartItem: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
  } as unknown as PrismaService;

  const repository = new PrismaCartRepository(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('finds active cart by customer', async () => {
    (prisma.cart.findFirst as jest.Mock).mockResolvedValue(cart);
    const result = await repository.findActiveByCustomerId(cart.customerId);
    expect(result?.id).toBe(cart.id);
    expect(prisma.cart.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerId: cart.customerId, status: CartStatus.ACTIVE },
      }),
    );
  });

  it('creates a cart', async () => {
    (prisma.cart.create as jest.Mock).mockResolvedValue(cart);
    await repository.createCart({
      customerId: cart.customerId,
      merchantId: cart.merchantId,
      currency: 'NGN',
    });
    expect(prisma.cart.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: CartStatus.ACTIVE }),
      }),
    );
  });

  it('finds duplicate items by product and variant', async () => {
    (prisma.cartItem.findFirst as jest.Mock).mockResolvedValue(null);
    await repository.findDuplicateItem(cart.id, 'ffffffff-ffff-ffff-ffff-ffffffffffff', null);
    expect(prisma.cartItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ variantId: null }),
      }),
    );
  });

  it('updates totals', async () => {
    (prisma.cart.update as jest.Mock).mockResolvedValue(cart);
    await repository.updateTotals(cart.id, {
      subtotal: 100,
      discount: 0,
      tax: 7.5,
      deliveryFee: 1500,
      total: 1607.5,
    });
    expect(prisma.cart.update).toHaveBeenCalled();
  });
});
