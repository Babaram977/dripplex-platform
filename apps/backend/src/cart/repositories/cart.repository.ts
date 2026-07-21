import type { Cart, CartItem, CartStatus, Prisma } from '@prisma/client';

export type CartWithItems = Cart & { items: CartItem[] };

export interface CreateCartInput {
  customerId: string;
  merchantId: string;
  currency: string;
}

export interface CreateCartItemInput {
  cartId: string;
  productId: string;
  variantId?: string | null;
  productNameSnapshot: string;
  skuSnapshot?: string | null;
  imageSnapshot?: string | null;
  unitPriceSnapshot: Prisma.Decimal | number | string;
  quantity: number;
  subtotal: Prisma.Decimal | number | string;
}

export interface UpdateCartItemInput {
  quantity: number;
  subtotal: Prisma.Decimal | number | string;
}

export interface UpdateCartTotalsInput {
  subtotal: Prisma.Decimal | number | string;
  discount: Prisma.Decimal | number | string;
  tax: Prisma.Decimal | number | string;
  deliveryFee: Prisma.Decimal | number | string;
  total: Prisma.Decimal | number | string;
}

export interface CartRepository {
  findActiveByCustomerId(customerId: string): Promise<CartWithItems | null>;
  findById(id: string): Promise<CartWithItems | null>;
  findByIdForCustomer(id: string, customerId: string): Promise<CartWithItems | null>;
  createCart(input: CreateCartInput): Promise<CartWithItems>;
  addItem(input: CreateCartItemInput): Promise<CartItem>;
  updateItem(id: string, input: UpdateCartItemInput): Promise<CartItem>;
  removeItem(id: string): Promise<void>;
  findItemById(id: string): Promise<CartItem | null>;
  findDuplicateItem(
    cartId: string,
    productId: string,
    variantId: string | null,
  ): Promise<CartItem | null>;
  clearItems(cartId: string): Promise<void>;
  updateTotals(cartId: string, totals: UpdateCartTotalsInput): Promise<Cart>;
  updateStatus(cartId: string, status: CartStatus): Promise<Cart>;
  abandonActiveCarts(customerId: string): Promise<number>;
}

export const CART_REPOSITORY = Symbol('CART_REPOSITORY');
