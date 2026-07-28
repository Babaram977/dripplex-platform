'use client';

import { useAuth } from '@dripplex/hooks';
import { Badge, Button, toast } from '@dripplex/ui';
import { Heart, Minus, Plus, Share2, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import * as React from 'react';

import type { ProductDetailDto } from '@dripplex/types';

import { CardGridSkeleton } from '@/components/marketplace/card-grid-skeleton';
import { ProductCard } from '@/components/marketplace/product-card';
import { RatingStars } from '@/components/marketplace/rating-stars';
import { addProductToCart, addProductToFavourites } from '@/lib/marketplace-actions';
import { describeSdkError, sdk } from '@/lib/sdk';
import { siteConfig } from '@/lib/site';

function formatPrice(basePrice: number, currency: string): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(basePrice);
}

export default function ProductDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const productId = params.id;
  const router = useRouter();
  const { hydrated, isAuthenticated } = useAuth();

  const [product, setProduct] = React.useState<ProductDetailDto | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [activeImage, setActiveImage] = React.useState(0);
  const [quantity, setQuantity] = React.useState(1);
  const [addingToCart, setAddingToCart] = React.useState(false);
  const [favouriting, setFavouriting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    sdk.products
      .get(productId)
      .then((data) => {
        if (!cancelled) {
          setProduct(data);
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
      toast({ title: 'Added to cart', description: `${product.name} × ${String(quantity)}` });
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
      <div className="container py-10">
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container py-10">
        <CardGridSkeleton count={1} />
      </div>
    );
  }

  const images = product.images;

  return (
    <div className="container flex flex-col gap-8 py-10 lg:flex-row">
      <div className="flex flex-col gap-3 lg:w-1/2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[activeImage]?.url ?? 'https://placehold.co/600x600?text=No+Image'}
          alt={product.name}
          className="bg-muted aspect-square w-full rounded-lg object-cover"
        />
        {images.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto">
            {images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                onClick={() => {
                  setActiveImage(index);
                }}
                className={`bg-muted h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 ${
                  index === activeImage ? 'border-primary' : 'border-transparent'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 lg:w-1/2">
        <div>
          {product.isFeatured ? <Badge variant="accent">Featured</Badge> : null}
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight">{product.name}</h1>
          {product.merchant ? (
            <Link
              href={`/marketplace/merchants/${product.merchant.merchantId}`}
              className="text-primary text-sm hover:underline"
            >
              {product.merchant.businessName}
            </Link>
          ) : null}
        </div>

        <RatingStars average={product.rating.average} count={product.rating.count} />

        <p className="font-display text-3xl font-semibold">
          {formatPrice(product.basePrice, product.currency)}
        </p>

        {!product.inStock ? <Badge variant="outline">Out of stock</Badge> : null}

        {product.description ? (
          <p className="text-muted-foreground text-sm">{product.description}</p>
        ) : null}

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Decrease quantity"
            disabled={quantity <= 1}
            onClick={() => {
              setQuantity((q) => Math.max(1, q - 1));
            }}
          >
            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <span className="w-8 text-center tabular-nums">{quantity}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Increase quantity"
            onClick={() => {
              setQuantity((q) => q + 1);
            }}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="lg"
            disabled={addingToCart || !product.inStock}
            onClick={() => {
              void onAddToCart();
            }}
          >
            <ShoppingCart className="mr-2 h-4 w-4" aria-hidden="true" />
            {addingToCart ? 'Adding…' : 'Add to cart'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={favouriting}
            onClick={() => {
              void onFavourite();
            }}
          >
            <Heart className="mr-2 h-4 w-4" aria-hidden="true" />
            Favourite
          </Button>
          <Button type="button" variant="ghost" size="lg" onClick={onShare}>
            <Share2 className="mr-2 h-4 w-4" aria-hidden="true" />
            Share
          </Button>
        </div>

        {product.relatedProducts.length > 0 ? (
          <div className="mt-6">
            <h2 className="font-display mb-4 text-xl font-semibold tracking-tight">
              Similar products
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {product.relatedProducts.map((related) => (
                <ProductCard key={related.id} product={related} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
