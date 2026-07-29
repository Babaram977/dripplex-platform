'use client';

import { EmptyState, Input, Select } from '@dripplex/ui';
import { useSearchParams } from 'next/navigation';
import * as React from 'react';

import type { CatalogSort, ProductSummaryDto } from '@dripplex/types';

import { CardGridSkeleton } from '@/components/marketplace/card-grid-skeleton';
import { ProductCard } from '@/components/marketplace/product-card';
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { describeSdkError, sdk } from '@/lib/sdk';

const SORT_OPTIONS: { value: CatalogSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating_desc', label: 'Best rated' },
  { value: 'popular', label: 'Popular' },
  { value: 'recommended', label: 'Recommended' },
];

export default function ProductListingPage(): React.JSX.Element {
  const searchParams = useSearchParams();
  const categoryId = searchParams.get('categoryId') ?? undefined;

  const [minPrice, setMinPrice] = React.useState('');
  const [maxPrice, setMaxPrice] = React.useState('');
  const [minRating, setMinRating] = React.useState('');
  const [inStockOnly, setInStockOnly] = React.useState(false);
  const [sort, setSort] = React.useState<CatalogSort>('newest');

  const [items, setItems] = React.useState<ProductSummaryDto[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [hasMore, setHasMore] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (nextCursor?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await sdk.products.browse({
          ...(categoryId ? { categoryId } : {}),
          ...(minPrice ? { minPrice: Number(minPrice) } : {}),
          ...(maxPrice ? { maxPrice: Number(maxPrice) } : {}),
          ...(minRating ? { minRating: Number(minRating) } : {}),
          ...(inStockOnly ? { inStock: true } : {}),
          sort,
          ...(nextCursor ? { cursor: nextCursor } : {}),
        });
        setItems((current) => (nextCursor ? [...current, ...result.items] : result.items));
        setCursor(result.nextCursor);
        setHasMore(result.hasMore);
      } catch (loadError) {
        setError(describeSdkError(loadError).description);
      } finally {
        setLoading(false);
      }
    },
    [categoryId, minPrice, maxPrice, minRating, inStockOnly, sort],
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  const sentinelRef = useInfiniteScroll(
    () => {
      if (cursor) {
        void load(cursor);
      }
    },
    { hasMore, disabled: loading },
  );

  return (
    <div className="container flex flex-col gap-6 py-10">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Products</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Browse the full DrippleX product catalog.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          aria-label="Minimum price"
          type="number"
          min="0"
          placeholder="Min price"
          className="w-32"
          value={minPrice}
          onChange={(event) => {
            setMinPrice(event.target.value);
          }}
        />
        <Input
          aria-label="Maximum price"
          type="number"
          min="0"
          placeholder="Max price"
          className="w-32"
          value={maxPrice}
          onChange={(event) => {
            setMaxPrice(event.target.value);
          }}
        />
        <Select
          aria-label="Minimum rating"
          className="w-40"
          value={minRating}
          onChange={(event) => {
            setMinRating(event.target.value);
          }}
        >
          <option value="">Any rating</option>
          <option value="4">4+ stars</option>
          <option value="3">3+ stars</option>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(event) => {
              setInStockOnly(event.target.checked);
            }}
          />
          In stock only
        </label>
        <Select
          aria-label="Sort by"
          className="ml-auto w-48"
          value={sort}
          onChange={(event) => {
            setSort(event.target.value as CatalogSort);
          }}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {items.length === 0 && loading ? (
        <CardGridSkeleton />
      ) : items.length === 0 ? (
        <EmptyState title="No products found" description="Try adjusting your filters." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          {loading ? <CardGridSkeleton count={4} /> : null}
        </>
      )}
      <div ref={sentinelRef} aria-hidden="true" />
    </div>
  );
}
