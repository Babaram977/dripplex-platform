import type { CartDto, CartItemDto, CartTotalsDto } from '@dripplex/types';
import type { Cart, CartItem } from '@prisma/client';

export function toCartItemDto(item: CartItem): CartItemDto {
  return {
    id: item.id,
    cartId: item.cartId,
    productId: item.productId,
    variantId: item.variantId,
    productNameSnapshot: item.productNameSnapshot,
    skuSnapshot: item.skuSnapshot,
    imageSnapshot: item.imageSnapshot,
    unitPriceSnapshot: Number(item.unitPriceSnapshot),
    quantity: item.quantity,
    subtotal: Number(item.subtotal),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export function toCartTotalsDto(cart: Cart): CartTotalsDto {
  return {
    subtotal: Number(cart.subtotal),
    discount: Number(cart.discount),
    tax: Number(cart.tax),
    deliveryFee: Number(cart.deliveryFee),
    total: Number(cart.total),
    currency: cart.currency,
  };
}

export function toCartDto(cart: Cart & { items: CartItem[] }): CartDto {
  return {
    id: cart.id,
    customerId: cart.customerId,
    merchantId: cart.merchantId,
    currency: cart.currency,
    status: cart.status,
    items: cart.items.map(toCartItemDto),
    totals: toCartTotalsDto(cart),
    createdAt: cart.createdAt.toISOString(),
    updatedAt: cart.updatedAt.toISOString(),
  };
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
