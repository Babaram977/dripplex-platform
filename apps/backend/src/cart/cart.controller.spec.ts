import { CART_PERMISSIONS } from './cart.constants';
import { CartController } from './cart.controller';

import type { CartService } from './cart.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { Request } from 'express';

describe('CartController', () => {
  const cartService = {
    getActiveCart: jest.fn(),
    addItem: jest.fn(),
    updateItem: jest.fn(),
    removeItem: jest.fn(),
    clearCart: jest.fn(),
    recalculate: jest.fn(),
  } as unknown as jest.Mocked<CartService>;

  const controller = new CartController(cartService);

  const user: AuthenticatedUser = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    sid: 's1',
    email: 'customer@dripplex.test',
    role: 'customer',
    portal: 'CUSTOMER_WEB',
    roles: ['customer'],
    permissions: [CART_PERMISSIONS.MANAGE],
  };

  const request = {
    ip: '127.0.0.1',
    headers: { 'user-agent': 'jest' },
  } as unknown as Request;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('gets active cart', async () => {
    (cartService.getActiveCart as jest.Mock).mockResolvedValue(null);
    const result = await controller.getCart(user);
    expect(result.data).toBeNull();
  });

  it('adds an item', async () => {
    (cartService.addItem as jest.Mock).mockResolvedValue({ id: 'cart-1' });
    const result = await controller.addItem(
      user,
      {
        merchantId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        productId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
        productName: 'Jollof',
        unitPrice: 2500,
        quantity: 1,
      },
      request,
    );
    expect(result.success).toBe(true);
    expect(cartService.addItem).toHaveBeenCalledWith(
      user.id,
      expect.any(Object),
      expect.objectContaining({ userId: user.id }),
    );
  });

  it('clears cart', async () => {
    (cartService.clearCart as jest.Mock).mockResolvedValue({ cleared: true, cartId: 'c1' });
    const result = await controller.clearCart(user, request);
    expect(result.data.cleared).toBe(true);
  });

  it('recalculates cart', async () => {
    (cartService.recalculate as jest.Mock).mockResolvedValue({ id: 'cart-1' });
    await controller.recalculate(user, request);
    expect(cartService.recalculate).toHaveBeenCalled();
  });
});
