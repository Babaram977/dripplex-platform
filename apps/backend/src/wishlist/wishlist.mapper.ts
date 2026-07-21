import type { Wishlist, WishlistItem } from '@prisma/client';

export interface WishlistItemDto {
  id: string;
  wishlistId: string;
  itemType: string;
  itemId: string;
  targetPrice: number | null;
  notifyPriceDrop: boolean;
  notifyBackInStock: boolean;
  addedAt: string;
}

export interface WishlistDto {
  id: string;
  customerId: string;
  name: string;
  shareToken: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  items: WishlistItemDto[];
}

export interface MoveWishlistToCartResultDto {
  wishlistId: string;
  productIds: string[];
  addedToCart: string[];
}

export type WishlistWithItems = Wishlist & { items: WishlistItem[] };

export function toWishlistItemDto(item: WishlistItem): WishlistItemDto {
  return {
    id: item.id,
    wishlistId: item.wishlistId,
    itemType: item.itemType,
    itemId: item.itemId,
    targetPrice: item.targetPrice === null ? null : Number(item.targetPrice),
    notifyPriceDrop: item.notifyPriceDrop,
    notifyBackInStock: item.notifyBackInStock,
    addedAt: item.addedAt.toISOString(),
  };
}

export function toWishlistDto(wishlist: WishlistWithItems): WishlistDto {
  return {
    id: wishlist.id,
    customerId: wishlist.customerId,
    name: wishlist.name,
    shareToken: wishlist.shareToken,
    isPublic: wishlist.isPublic,
    createdAt: wishlist.createdAt.toISOString(),
    updatedAt: wishlist.updatedAt.toISOString(),
    items: wishlist.items.map(toWishlistItemDto),
  };
}
