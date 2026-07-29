import type { ProductSummaryDto } from '@dripplex/types';

import { sdk } from '@/lib/sdk';

const DEFAULT_WISHLIST_NAME = 'Favourites';

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
