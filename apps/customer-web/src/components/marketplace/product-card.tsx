'use client';

import { useAuth } from '@dripplex/hooks';
import { Badge, Button, Card, toast } from '@dripplex/ui';
import { Heart, Minus, Plus, Share2, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { RatingStars } from './rating-stars';

import type { ProductSummaryDto } from '@dripplex/types';

import { addProductToCart, addProductToFavourites } from '@/lib/marketplace-actions';
import { describeSdkError } from '@/lib/sdk';
import { siteConfig } from '@/lib/site';

function formatPrice(basePrice: number, currency: string): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(basePrice);
}

interface ProductCardProps {
  product: ProductSummaryDto;
}

export function ProductCard({ product }: ProductCardProps): React.JSX.Element {
  const router = useRouter();
  const { hydrated, isAuthenticated } = useAuth();
  const [quantity, setQuantity] = React.useState(1);
  const [addingToCart, setAddingToCart] = React.useState(false);
  const [favouriting, setFavouriting] = React.useState(false);

  const requireAuth = (): boolean => {
    if (hydrated && !isAuthenticated) {
      toast({ title: 'Sign in required', description: 'Log in to continue.' });
      router.push(siteConfig.links.login);
      return false;
    }
    return true;
  };

  const onAddToCart = async (): Promise<void> => {
    if (!requireAuth()) {
      return;
    }
    setAddingToCart(true);
    try {
      await addProductToCart(product, quantity);
      toast({ title: 'Added to cart', description: `${product.name} × ${String(quantity)}` });
    } catch (error) {
      const described = describeSdkError(error);
      toast({ title: described.title, description: described.description, variant: 'destructive' });
    } finally {
      setAddingToCart(false);
    }
  };

  const onFavourite = async (): Promise<void> => {
    if (!requireAuth()) {
      return;
    }
    setFavouriting(true);
    try {
      await addProductToFavourites(product.id);
      toast({ title: 'Saved', description: `${product.name} added to favourites.` });
    } catch (error) {
      const described = describeSdkError(error);
      toast({ title: described.title, description: described.description, variant: 'destructive' });
    } finally {
      setFavouriting(false);
    }
  };

  const onShare = (): void => {
    if (typeof navigator === 'undefined') {
      return;
    }
    const url = `${siteConfig.url}/marketplace/products/${product.id}`;
    try {
      void navigator.share({ title: product.name, url });
    } catch {
      void navigator.clipboard.writeText(url).then(() => {
        toast({ title: 'Link copied', description: 'Product link copied to clipboard.' });
      });
    }
  };

  return (
    <Card className="flex flex-col overflow-hidden">
      <Link href={`/marketplace/products/${product.id}`} className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.primaryImageUrl ?? 'https://placehold.co/400x400?text=No+Image'}
          alt={product.name}
          loading="lazy"
          className="bg-muted aspect-square w-full object-cover"
        />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/marketplace/products/${product.id}`} className="min-w-0">
            <p className="truncate text-sm font-medium">{product.name}</p>
          </Link>
          {product.isFeatured ? (
            <Badge variant="accent" className="shrink-0">
              Featured
            </Badge>
          ) : null}
        </div>
        <p className="text-muted-foreground truncate text-xs">{product.merchantName}</p>
        <RatingStars average={product.rating.average} count={product.rating.count} />
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="font-display text-base font-semibold">
            {formatPrice(product.basePrice, product.currency)}
          </span>
          {!product.inStock ? <Badge variant="outline">Out of stock</Badge> : null}
        </div>

        <div className="flex items-center gap-1">
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
          <span className="w-6 text-center text-sm tabular-nums">{quantity}</span>
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
          <Button
            type="button"
            className="ml-auto"
            disabled={addingToCart || !product.inStock}
            onClick={() => {
              void onAddToCart();
            }}
          >
            <ShoppingCart className="mr-2 h-4 w-4" aria-hidden="true" />
            {addingToCart ? 'Adding…' : 'Add'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Add to favourites"
            disabled={favouriting}
            onClick={() => {
              void onFavourite();
            }}
          >
            <Heart className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Share" onClick={onShare}>
            <Share2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
