'use client';

import { Button, EmptyState, Select } from '@dripplex/ui';
import { LocateFixed } from 'lucide-react';
import * as React from 'react';

import type { BusinessType, MerchantSort, MerchantSummaryDto } from '@dripplex/types';

import { CardGridSkeleton } from '@/components/marketplace/card-grid-skeleton';
import { MerchantCard } from '@/components/marketplace/merchant-card';
import { useGeolocation } from '@/hooks/use-geolocation';
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { describeSdkError, sdk } from '@/lib/sdk';

const BUSINESS_TYPE_OPTIONS: { value: BusinessType | ''; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'SOLE_PROPRIETORSHIP', label: 'Sole proprietorship' },
  { value: 'PARTNERSHIP', label: 'Partnership' },
  { value: 'LIMITED_LIABILITY', label: 'Limited liability' },
  { value: 'CORPORATION', label: 'Corporation' },
  { value: 'OTHER', label: 'Other' },
];

const SORT_OPTIONS: { value: MerchantSort; label: string }[] = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'nearest', label: 'Nearest' },
  { value: 'rating_desc', label: 'Best rated' },
  { value: 'newest', label: 'Newest' },
];

export default function MerchantListingPage(): React.JSX.Element {
  const { location, requesting, error: locationError, request: requestLocation } = useGeolocation();
  const [businessType, setBusinessType] = React.useState<BusinessType | ''>('');
  const [minRating, setMinRating] = React.useState('');
  const [sort, setSort] = React.useState<MerchantSort>('recommended');

  const [items, setItems] = React.useState<MerchantSummaryDto[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [hasMore, setHasMore] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (nextCursor?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await sdk.merchants.browse({
          ...(businessType ? { businessType } : {}),
          ...(minRating ? { minRating: Number(minRating) } : {}),
          sort,
          ...(location ? { lat: location.lat, lng: location.lng } : {}),
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
    [businessType, minRating, sort, location],
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
        <h1 className="font-display text-3xl font-semibold tracking-tight">Merchants</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Browse merchants on the DrippleX marketplace.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          aria-label="Business type"
          className="w-52"
          value={businessType}
          onChange={(event) => {
            setBusinessType(event.target.value as BusinessType | '');
          }}
        >
          {BUSINESS_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
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
        <Select
          aria-label="Sort by"
          className="w-44"
          value={sort}
          onChange={(event) => {
            setSort(event.target.value as MerchantSort);
          }}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Button type="button" variant="outline" disabled={requesting} onClick={requestLocation}>
          <LocateFixed className="mr-2 h-4 w-4" aria-hidden="true" />
          {location ? 'Location set' : requesting ? 'Locating…' : 'Use my location'}
        </Button>
      </div>
      {locationError ? <p className="text-muted-foreground text-xs">{locationError}</p> : null}

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {items.length === 0 && loading ? (
        <CardGridSkeleton count={9} />
      ) : items.length === 0 ? (
        <EmptyState title="No merchants found" description="Try a different filter." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((merchant) => (
              <MerchantCard key={merchant.id} merchant={merchant} />
            ))}
          </div>
          {loading ? <CardGridSkeleton count={3} /> : null}
        </>
      )}
      <div ref={sentinelRef} aria-hidden="true" />
    </div>
  );
}
