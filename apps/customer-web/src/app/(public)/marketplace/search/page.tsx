'use client';

import { Badge } from '@dripplex/ui';
import { useSearchParams } from 'next/navigation';
import * as React from 'react';

import type { MerchantSummaryDto, ParsedSmartQueryDto, ProductSummaryDto } from '@dripplex/types';

import { CardGridSkeleton } from '@/components/marketplace/card-grid-skeleton';
import { MerchantCard } from '@/components/marketplace/merchant-card';
import { ProductCard } from '@/components/marketplace/product-card';
import { SmartSearchBar } from '@/components/marketplace/smart-search-bar';
import { describeSdkError, sdk } from '@/lib/sdk';

export default function MarketplaceSearchPage(): React.JSX.Element {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') ?? '';

  const [parsed, setParsed] = React.useState<ParsedSmartQueryDto | null>(null);
  const [products, setProducts] = React.useState<ProductSummaryDto[] | null>(null);
  const [merchants, setMerchants] = React.useState<MerchantSummaryDto[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!query) {
      return;
    }
    setProducts(null);
    setMerchants(null);
    setError(null);
    let cancelled = false;
    Promise.all([sdk.products.smartSearch({ query }), sdk.merchants.smartSearch({ query })])
      .then(([productResult, merchantResult]) => {
        if (!cancelled) {
          setParsed(productResult.parsed);
          setProducts(productResult.results.items);
          setMerchants(merchantResult.results.items);
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
  }, [query]);

  return (
    <div className="container flex flex-col gap-8 py-10">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Results for &ldquo;{query}&rdquo;
        </h1>
        <SmartSearchBar defaultValue={query} />
        {parsed ? (
          <div className="flex flex-wrap justify-center gap-2">
            {parsed.maxPrice !== undefined ? (
              <Badge variant="secondary">Under ₦{parsed.maxPrice.toLocaleString('en-NG')}</Badge>
            ) : null}
            {parsed.nearMe ? <Badge variant="secondary">Near me</Badge> : null}
            {parsed.openNow ? <Badge variant="secondary">Open now</Badge> : null}
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-semibold tracking-tight">Merchants</h2>
        {!merchants ? (
          <CardGridSkeleton count={3} />
        ) : merchants.length === 0 ? (
          <p className="text-muted-foreground text-sm">No matching merchants.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {merchants.map((merchant) => (
              <MerchantCard key={merchant.id} merchant={merchant} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-semibold tracking-tight">Products</h2>
        {!products ? (
          <CardGridSkeleton />
        ) : products.length === 0 ? (
          <p className="text-muted-foreground text-sm">No matching products.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
