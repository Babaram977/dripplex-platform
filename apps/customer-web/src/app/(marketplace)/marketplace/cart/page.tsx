'use client';

import { useAuth } from '@dripplex/hooks';
import {
  SuperAppCartCheckoutBar,
  SuperAppCartEmptyState,
  SuperAppCartMerchantGroup,
  SuperAppCartOrderSummary,
  SuperAppCartSkeleton,
  SuperAppSavedForLaterSection,
  toast,
} from '@dripplex/ui';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import type { CartDto } from '@dripplex/types';

import { formatPrice } from '@/lib/format';
import {
  listSavedForLaterProducts,
  moveSavedForLaterItemToCart,
  saveCartItemForLater,
  type SavedForLaterProduct,
} from '@/lib/marketplace-actions';
import { describeSdkError, sdk } from '@/lib/sdk';
import { siteConfig } from '@/lib/site';

function formatDeliveryFee(fee: number, currency: string): string {
  return fee === 0 ? 'FREE' : formatPrice(fee, currency);
}

export default function CartPage(): React.JSX.Element {
  const router = useRouter();
  const { hydrated, isAuthenticated } = useAuth();

  const [cart, setCart] = React.useState<CartDto | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [savedForLater, setSavedForLater] = React.useState<SavedForLaterProduct[]>([]);
  const [merchantName, setMerchantName] = React.useState<string | null>(null);

  const loadCart = React.useCallback(async (): Promise<void> => {
    try {
      const data = await sdk.cart.get();
      setCart(data);
      if (data?.merchantId) {
        try {
          const firstItemProductId = data.items[0]?.productId;
          if (firstItemProductId) {
            const product = await sdk.products.get(firstItemProductId);
            setMerchantName(product.merchant?.businessName ?? null);
          }
        } catch {
          setMerchantName(null);
        }
      }
    } catch (loadError) {
      setError(describeSdkError(loadError).description);
    } finally {
      setLoaded(true);
    }
  }, []);

  React.useEffect(() => {
    if (!hydrated) {
      return;
    }
    if (!isAuthenticated) {
      setLoaded(true);
      return;
    }
    void loadCart();
    listSavedForLaterProducts()
      .then(setSavedForLater)
      .catch(() => {
        // Saved-for-later is supplementary — a failed fetch shouldn't block the cart page.
      });
  }, [hydrated, isAuthenticated, loadCart]);

  const onDecrementItem = async (itemId: string): Promise<void> => {
    const item = cart?.items.find((i) => i.id === itemId);
    if (!item) return;
    if (item.quantity <= 1) return;
    try {
      const updated = await sdk.cart.updateItem(itemId, { quantity: item.quantity - 1 });
      setCart(updated);
    } catch (updateError) {
      const described = describeSdkError(updateError);
      toast({ title: described.title, description: described.description, variant: 'destructive' });
    }
  };

  const onIncrementItem = async (itemId: string): Promise<void> => {
    const item = cart?.items.find((i) => i.id === itemId);
    if (!item) return;
    try {
      const updated = await sdk.cart.updateItem(itemId, { quantity: item.quantity + 1 });
      setCart(updated);
    } catch (updateError) {
      const described = describeSdkError(updateError);
      toast({ title: described.title, description: described.description, variant: 'destructive' });
    }
  };

  const onRemoveItem = async (itemId: string): Promise<void> => {
    try {
      const updated = await sdk.cart.removeItem(itemId);
      setCart(updated);
    } catch (removeError) {
      const described = describeSdkError(removeError);
      toast({ title: described.title, description: described.description, variant: 'destructive' });
    }
  };

  const onSaveItemForLater = async (itemId: string): Promise<void> => {
    const item = cart?.items.find((i) => i.id === itemId);
    if (!item) return;
    try {
      await saveCartItemForLater(itemId, item.productId);
      await loadCart();
      const saved = await listSavedForLaterProducts();
      setSavedForLater(saved);
      toast({
        title: 'Saved for later',
        description: `${item.productNameSnapshot} moved to your saved items.`,
      });
    } catch (saveError) {
      const described = describeSdkError(saveError);
      toast({ title: described.title, description: described.description, variant: 'destructive' });
    }
  };

  const onMoveToCart = async (wishlistItemId: string): Promise<void> => {
    const item = savedForLater.find((s) => s.wishlistItemId === wishlistItemId);
    if (!item) return;
    try {
      await moveSavedForLaterItemToCart(item);
      await loadCart();
      setSavedForLater((prev) => prev.filter((s) => s.wishlistItemId !== wishlistItemId));
      toast({ title: 'Added to cart', description: item.product.name });
    } catch (moveError) {
      const described = describeSdkError(moveError);
      toast({ title: described.title, description: described.description, variant: 'destructive' });
    }
  };

  const onCheckout = (): void => {
    if (hydrated && !isAuthenticated) {
      toast({ title: 'Sign in required', description: 'Log in to continue.' });
      router.push(siteConfig.links.login);
      return;
    }
    // TODO: route to the real Checkout screen once it's built (next in the Marketplace sequence).
    toast({
      title: 'Checkout is coming next',
      description: 'The Checkout screen is being built next.',
    });
  };

  if (!hydrated || !loaded) {
    return (
      <div className="absolute inset-0 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <SuperAppCartSkeleton />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="absolute inset-0 flex flex-col overflow-hidden">
        <SuperAppCartEmptyState
          onBrowse={() => {
            router.push(siteConfig.links.login);
          }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
        <p className="text-sm text-white/70" role="alert">
          {error}
        </p>
      </div>
    );
  }

  const savedForLaterItems = savedForLater.map((s) => ({
    id: s.wishlistItemId,
    name: s.product.name,
    imageUrl: s.product.images[0]?.url ?? null,
    priceLabel: formatPrice(s.product.basePrice, s.product.currency),
  }));

  if (!cart || cart.items.length === 0) {
    return (
      <div className="absolute inset-0 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-5 pb-8">
          <SuperAppCartEmptyState
            onBrowse={() => {
              router.push('/marketplace');
            }}
          />
          <SuperAppSavedForLaterSection
            items={savedForLaterItems}
            onMoveToCart={(id) => {
              void onMoveToCart(id);
            }}
          />
        </div>
      </div>
    );
  }

  const cartItems = cart.items.map((item) => ({
    id: item.id,
    name: item.productNameSnapshot,
    imageUrl: item.imageSnapshot,
    unitPriceLabel: formatPrice(item.unitPriceSnapshot, cart.currency),
    quantity: item.quantity,
    lineTotalLabel: formatPrice(item.subtotal, cart.currency),
  }));

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-5 pb-32 pt-6" style={{ scrollbarWidth: 'none' }}>
        <SuperAppCartMerchantGroup
          merchantName={merchantName ?? 'Your Order'}
          items={cartItems}
          subtotalLabel={formatPrice(cart.totals.subtotal, cart.currency)}
          deliveryFeeLabel={formatDeliveryFee(cart.totals.deliveryFee, cart.currency)}
          onDecrementItem={(id) => {
            void onDecrementItem(id);
          }}
          onIncrementItem={(id) => {
            void onIncrementItem(id);
          }}
          onRemoveItem={(id) => {
            void onRemoveItem(id);
          }}
          onSaveItemForLater={(id) => {
            void onSaveItemForLater(id);
          }}
        />

        <SuperAppCartOrderSummary
          itemsTotalLabel={formatPrice(cart.totals.subtotal, cart.currency)}
          deliveryFeeLabel={formatDeliveryFee(cart.totals.deliveryFee, cart.currency)}
          discountLabel={
            cart.totals.discount > 0
              ? `−${formatPrice(cart.totals.discount, cart.currency)}`
              : undefined
          }
          taxLabel={formatPrice(cart.totals.tax, cart.currency)}
          grandTotalLabel={formatPrice(cart.totals.total, cart.currency)}
        />

        <SuperAppSavedForLaterSection
          items={savedForLaterItems}
          onMoveToCart={(id) => {
            void onMoveToCart(id);
          }}
        />
      </div>

      <SuperAppCartCheckoutBar
        grandTotalLabel={formatPrice(cart.totals.total, cart.currency)}
        onCheckout={onCheckout}
        navTab="marketplace"
      />
    </div>
  );
}
