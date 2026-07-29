'use client';

import { Button } from '@dripplex/ui';
import Link from 'next/link';
import * as React from 'react';

import type { MerchantSummaryDto } from '@dripplex/types';

import { CardGridSkeleton } from '@/components/marketplace/card-grid-skeleton';
import { CategoryStrip } from '@/components/marketplace/category-strip';
import { MerchantCard } from '@/components/marketplace/merchant-card';
import { PromotionsStrip } from '@/components/marketplace/promotions-strip';
import { SmartSearchBar } from '@/components/marketplace/smart-search-bar';
import { describeSdkError, sdk } from '@/lib/sdk';

const FEATURED_MERCHANTS_LIMIT = 6;

export default function MarketplaceHomePage(): React.JSX.Element {
  const [merchants, setMerchants] = React.useState<MerchantSummaryDto[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    sdk.merchants
      .browse({ sort: 'recommended', limit: FEATURED_MERCHANTS_LIMIT })
      .then((result) => {
        if (!cancelled) {
          setMerchants(result.items);
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
  }, []);

  return (
    <div className="container flex flex-col gap-10 py-10">
      <section className="flex flex-col items-center gap-6 text-center">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">Marketplace</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Discover merchants and everyday essentials near you.
          </p>
        </div>
        <SmartSearchBar />
      </section>

      <CategoryStrip />

      <PromotionsStrip />

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Featured merchants</h2>
          <Button asChild variant="ghost">
            <Link href="/marketplace/merchants">View all</Link>
          </Button>
        </div>

        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : !merchants ? (
          <CardGridSkeleton count={FEATURED_MERCHANTS_LIMIT} />
        ) : merchants.length === 0 ? (
          <p className="text-muted-foreground text-sm">No merchants yet — check back soon.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {merchants.map((merchant) => (
              <MerchantCard key={merchant.id} merchant={merchant} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Browse products</h2>
          <Button asChild variant="ghost">
            <Link href="/marketplace/products">View all</Link>
          </Button>
        </div>
        <p className="text-muted-foreground text-sm">
          Explore the full catalog with filters for category, price, rating, and more.
        </p>
      </section>
    </div>
  );
}
