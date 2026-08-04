import type { OrderItemDto, ProductDetailDto, ProductSummaryDto } from '@dripplex/types';

import { sdk } from '@/lib/sdk';

const DEFAULT_WISHLIST_NAME = 'Favourites';

export interface SavedForLaterProduct {
  wishlistId: string;
  wishlistItemId: string;
  product: ProductDetailDto;
}

export async function addProductToCart(
  product: Pick<ProductSummaryDto, 'id' | 'merchantId' | 'name' | 'basePrice' | 'primaryImageUrl'>,
  quantity: number,
): Promise<void> {
  await sdk.cart.addItem({
    merchantId: product.merchantId,
    productId: product.id,
    productName: product.name,
    unitPrice: product.basePrice,
    quantity,
    ...(product.primaryImageUrl ? { imageUrl: product.primaryImageUrl } : {}),
  });
}

/** Re-adds a delivered/completed order's items to the cart, one at a time
 * (the cart is single-merchant, and a past order's items always share one
 * merchant, so this never hits `CartMerchantConflictDomainException`). */
export async function reorderItems(items: OrderItemDto[]): Promise<void> {
  for (const item of items) {
    await sdk.cart.addItem({
      merchantId: item.merchantId,
      productId: item.productId,
      productName: item.snapshotName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      ...(item.snapshotImage ? { imageUrl: item.snapshotImage } : {}),
    });
  }
}

/**
 * Wishlists are named/multi-list in the backend; the marketplace's single
 * "Favourite" heart icon needs one default list. Reuses the first existing
 * wishlist, or creates one named "Favourites" on first use.
 */
async function defaultWishlistId(): Promise<string> {
  const lists = await sdk.wishlist.list();
  const existing = lists[0];
  if (existing) {
    return existing.id;
  }
  const created = await sdk.wishlist.create({ name: DEFAULT_WISHLIST_NAME });
  return created.id;
}

export async function addProductToFavourites(productId: string): Promise<void> {
  const wishlistId = await defaultWishlistId();
  await sdk.wishlist.addItem(wishlistId, { itemType: 'PRODUCT', itemId: productId });
}

/**
 * "Save for Later" on a cart line: remove it from the cart and add the
 * product to the default wishlist, reusing the same wishlist the
 * Favourite heart writes to (Cart's "Saved for Later" and Marketplace's
 * "Favourites" are the same underlying list).
 */
export async function saveCartItemForLater(cartItemId: string, productId: string): Promise<void> {
  await sdk.cart.removeItem(cartItemId);
  const wishlistId = await defaultWishlistId();
  await sdk.wishlist.addItem(wishlistId, { itemType: 'PRODUCT', itemId: productId });
}

/**
 * `WishlistItemDto` only stores `itemId` (no name/price/image snapshot),
 * so listing "Saved for Later" resolves each PRODUCT-type wishlist item
 * against the real product catalog. Acceptable N+1 at cart-list scale.
 */
export async function listSavedForLaterProducts(): Promise<SavedForLaterProduct[]> {
  const lists = await sdk.wishlist.list();
  const items = lists.flatMap((list) =>
    list.items.map((item) => ({ ...item, wishlistId: list.id })),
  );
  const productItems = items.filter((item) => item.itemType === 'PRODUCT');

  const resolved = await Promise.all(
    productItems.map(async (item) => {
      try {
        const product = await sdk.products.get(item.itemId);
        return { wishlistItemId: item.id, wishlistId: item.wishlistId, product };
      } catch {
        return null;
      }
    }),
  );

  return resolved.filter((entry): entry is SavedForLaterProduct => entry !== null);
}

/** Moves a "Saved for Later" item back into the cart and off the wishlist. */
export async function moveSavedForLaterItemToCart(item: SavedForLaterProduct): Promise<void> {
  const { product } = item;
  await addProductToCart(
    {
      id: product.id,
      merchantId: product.merchantId,
      name: product.name,
      basePrice: product.basePrice,
      primaryImageUrl: product.images[0]?.url ?? null,
    },
    1,
  );
  await sdk.wishlist.removeItem(item.wishlistId, item.wishlistItemId);
}
