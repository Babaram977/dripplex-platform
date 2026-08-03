'use client';

import { useAuth } from '@dripplex/hooks';
import {
  G2,
  SuperAppCartConfirmationSheet,
  SuperAppMerchantMiniCard,
  SuperAppProductActionBar,
  SuperAppProductDescription,
  SuperAppProductDetailSkeleton,
  SuperAppProductGallery,
  SuperAppProductInfoHeader,
  SuperAppProductQuantityRow,
  SuperAppProductReviewsSection,
  SuperAppProductVariantSelector,
  SuperAppRelatedProductsSection,
  toast,
  type SuperAppReviewSort,
} from '@dripplex/ui';
import { useParams, useRouter } from 'next/navigation';
import * as React from 'react';

import type { ProductDetailDto, ReviewWithAggregateDto } from '@dripplex/types';

import { addProductToCart, addProductToFavourites } from '@/lib/marketplace-actions';
import { describeSdkError, sdk } from '@/lib/sdk';
import { siteConfig } from '@/lib/site';

function formatPrice(basePrice: number, currency: string): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(basePrice);
}

function formatReviewDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ProductDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const productId = params.id;
  const router = useRouter();
  const { hydrated, isAuthenticated } = useAuth();

  const [product, setProduct] = React.useState<ProductDetailDto | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [reviewsData, setReviewsData] = React.useState<ReviewWithAggregateDto | null>(null);
  const [reviewSort, setReviewSort] = React.useState<SuperAppReviewSort>('recent');
  const [quantity, setQuantity] = React.useState(1);
  const [selectedVariantId, setSelectedVariantId] = React.useState<string | null>(null);
  const [favorited, setFavorited] = React.useState(false);
  const [addingToCart, setAddingToCart] = React.useState(false);
  const [favouriting, setFavouriting] = React.useState(false);
  const [cartSheetOpen, setCartSheetOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    sdk.products
      .get(productId)
      .then((data) => {
        if (!cancelled) {
          setProduct(data);
          setSelectedVariantId(data.variants.find((v) => v.isActive)?.id ?? null);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(describeSdkError(loadError).description);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  React.useEffect(() => {
    let cancelled = false;
    sdk.reviews
      .listForTarget('PRODUCT', productId, { page: 1, pageSize: 20 })
      .then((data) => {
        if (!cancelled) {
          setReviewsData(data);
        }
      })
      .catch(() => {
        // Reviews are supplementary — a failed fetch shouldn't block the product page.
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const requireAuth = (): boolean => {
    if (hydrated && !isAuthenticated) {
      toast({ title: 'Sign in required', description: 'Log in to continue.' });
      router.push(siteConfig.links.login);
      return false;
    }
    return true;
  };

  const onAddToCart = async (): Promise<void> => {
    if (!product || !requireAuth()) {
      return;
    }
    setAddingToCart(true);
    try {
      await addProductToCart(
        {
          id: product.id,
          merchantId: product.merchantId,
          name: product.name,
          basePrice: product.basePrice,
          primaryImageUrl: product.images[0]?.url ?? null,
        },
        quantity,
      );
      setCartSheetOpen(true);
    } catch (addError) {
      const described = describeSdkError(addError);
      toast({ title: described.title, description: described.description, variant: 'destructive' });
    } finally {
      setAddingToCart(false);
    }
  };

  const onFavourite = async (): Promise<void> => {
    if (!product || !requireAuth()) {
      return;
    }
    setFavouriting(true);
    try {
      await addProductToFavourites(product.id);
      setFavorited(true);
      toast({ title: 'Saved', description: `${product.name} added to favourites.` });
    } catch (favError) {
      const described = describeSdkError(favError);
      toast({ title: described.title, description: described.description, variant: 'destructive' });
    } finally {
      setFavouriting(false);
    }
  };

  const onShare = (): void => {
    if (typeof navigator === 'undefined') {
      return;
    }
    const url = `${siteConfig.url}/marketplace/products/${productId}`;
    try {
      void navigator.share({ title: product?.name, url });
    } catch {
      void navigator.clipboard.writeText(url).then(() => {
        toast({ title: 'Link copied', description: 'Product link copied to clipboard.' });
      });
    }
  };

  if (error) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
        <p className="text-sm text-white/70" role="alert">
          {error}
        </p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="absolute inset-0 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <SuperAppProductDetailSkeleton />
        </div>
      </div>
    );
  }

  const selectedVariant = product.variants.find((v) => v.id === selectedVariantId) ?? null;
  const unitPrice = selectedVariant?.priceOverride ?? product.basePrice;
  const totalPriceLabel = formatPrice(unitPrice * quantity, product.currency);
  const outOfStock = !product.inStock;
  const galleryImages =
    product.images.length > 0 ? product.images.map((img) => ({ url: img.url })) : [{ url: null }];

  const aggregate = reviewsData?.aggregate ?? null;
  const sortedReviews = [...(reviewsData?.items ?? [])].sort((a, b) => {
    if (reviewSort === 'highest') return b.rating - a.rating;
    if (reviewSort === 'lowest') return a.rating - b.rating;
    return 0;
  });

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none', paddingBottom: 96 }}>
        <SuperAppProductGallery
          images={galleryImages}
          favorited={favorited}
          onBack={() => {
            router.back();
          }}
          onShare={onShare}
          onToggleFavorite={
            favouriting
              ? undefined
              : () => {
                  void onFavourite();
                }
          }
        />

        <SuperAppProductInfoHeader
          name={product.name}
          merchantName={product.merchant?.businessName}
          ratingAverage={product.rating.average}
          ratingCount={product.rating.count}
          priceLabel={formatPrice(unitPrice, product.currency)}
          availabilityLabel={outOfStock ? 'Out of Stock' : 'In Stock'}
          outOfStock={outOfStock}
          skuLabel={product.sku ?? undefined}
        />

        <div className="mx-5 my-3 h-px bg-white/[.08]" />

        {product.description ? (
          <SuperAppProductDescription description={product.description} />
        ) : null}

        {product.variants.length > 0 ? (
          <SuperAppProductVariantSelector
            label="Options"
            options={product.variants.map((v) => ({
              id: v.id,
              label: v.name,
              priceLabel:
                v.priceOverride !== null
                  ? formatPrice(v.priceOverride, product.currency)
                  : undefined,
              available: v.isActive,
            }))}
            selectedId={selectedVariantId}
            onSelect={setSelectedVariantId}
          />
        ) : null}

        <SuperAppProductQuantityRow
          quantity={quantity}
          onDecrement={() => {
            setQuantity((q) => Math.max(1, q - 1));
          }}
          onIncrement={() => {
            setQuantity((q) => q + 1);
          }}
        />

        {product.merchant ? (
          <SuperAppMerchantMiniCard
            businessName={product.merchant.businessName}
            logoUrl={product.merchant.logoUrl}
            city={product.merchant.city}
            state={product.merchant.state}
            onVisitStore={() => {
              const merchantId = product.merchant?.merchantId;
              if (merchantId) {
                router.push(`/marketplace/merchants/${merchantId}`);
              }
            }}
          />
        ) : null}

        {reviewsData ? (
          <SuperAppProductReviewsSection
            averageRating={aggregate?.averageRating ?? 0}
            reviewCount={aggregate?.reviewCount ?? 0}
            breakdown={[
              aggregate?.rating5 ?? 0,
              aggregate?.rating4 ?? 0,
              aggregate?.rating3 ?? 0,
              aggregate?.rating2 ?? 0,
              aggregate?.rating1 ?? 0,
            ]}
            reviews={sortedReviews.map((r) => ({
              id: r.id,
              rating: r.rating,
              date: formatReviewDate(r.createdAt),
              comment: r.comment ?? '',
              merchantReply: r.merchantReply ?? undefined,
            }))}
            sort={reviewSort}
            onSortChange={setReviewSort}
          />
        ) : null}

        {product.relatedProducts.length > 0 ? (
          <SuperAppRelatedProductsSection
            products={product.relatedProducts.map((related) => ({
              id: related.id,
              name: related.name,
              priceLabel: formatPrice(related.basePrice, related.currency),
              imageUrl: related.primaryImageUrl,
              badge: related.isFeatured ? 'Featured' : undefined,
              badgeColor: related.isFeatured ? G2 : undefined,
            }))}
            onSelect={(relatedId) => {
              router.push(`/marketplace/products/${relatedId}`);
            }}
          />
        ) : null}
      </div>

      <SuperAppProductActionBar
        quantity={quantity}
        onDecrement={() => {
          setQuantity((q) => Math.max(1, q - 1));
        }}
        onIncrement={() => {
          setQuantity((q) => q + 1);
        }}
        totalPriceLabel={totalPriceLabel}
        outOfStock={outOfStock || addingToCart}
        onAddToCart={() => {
          void onAddToCart();
        }}
        navTab="marketplace"
      />

      {cartSheetOpen ? (
        <SuperAppCartConfirmationSheet
          productName={product.name}
          priceLabel={formatPrice(unitPrice, product.currency)}
          quantity={quantity}
          imageUrl={product.images[0]?.url}
          onContinueShopping={() => {
            setCartSheetOpen(false);
          }}
          onViewCart={() => {
            // TODO: route to the real Cart screen once it's built (next in the
            // Marketplace sequence) — there is no /marketplace/cart route yet.
            setCartSheetOpen(false);
            toast({ title: 'In your cart', description: `${product.name} is saved to your cart.` });
          }}
        />
      ) : null}
    </div>
  );
}
