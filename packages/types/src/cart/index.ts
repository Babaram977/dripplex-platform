export type CartStatus = 'ACTIVE' | 'CHECKED_OUT' | 'ABANDONED' | 'LOCKED';

export interface CartItemDto {
  id: string;
  cartId: string;
  productId: string;
  variantId: string | null;
  productNameSnapshot: string;
  skuSnapshot: string | null;
  imageSnapshot: string | null;
  unitPriceSnapshot: number;
  quantity: number;
  subtotal: number;
  createdAt: string;
  updatedAt: string;
}

export interface CartTotalsDto {
  subtotal: number;
  discount: number;
  tax: number;
  deliveryFee: number;
  total: number;
  currency: string;
}

export interface CartDto {
  id: string;
  customerId: string;
  merchantId: string;
  currency: string;
  status: CartStatus;
  items: CartItemDto[];
  totals: CartTotalsDto;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCartItemDto {
  merchantId: string;
  productId: string;
  variantId?: string;
  productName: string;
  sku?: string;
  imageUrl?: string;
  unitPrice: number;
  quantity: number;
  currency?: string;
}

export interface UpdateCartItemDto {
  quantity: number;
}

export interface CartSummaryDto {
  cleared: boolean;
  cartId: string | null;
}

export interface MerchantConflictError {
  errorCode: 'CART_MERCHANT_CONFLICT';
  message: string;
  cartMerchantId: string;
  requestedMerchantId: string;
}

export const CART_AUDIT_ACTIONS = {
  CREATED: 'cart.created',
  ITEM_ADDED: 'cart.item_added',
  ITEM_UPDATED: 'cart.item_updated',
  ITEM_REMOVED: 'cart.item_removed',
  CLEARED: 'cart.cleared',
  RECALCULATED: 'cart.recalculated',
} as const;

export type CartAuditAction = (typeof CART_AUDIT_ACTIONS)[keyof typeof CART_AUDIT_ACTIONS];
