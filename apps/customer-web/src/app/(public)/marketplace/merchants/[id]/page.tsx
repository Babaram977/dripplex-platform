'use client';

import { Badge, EmptyState } from '@dripplex/ui';
import { BadgeCheck, Clock, MapPin } from 'lucide-react';
import { useParams } from 'next/navigation';
import * as React from 'react';

import type { MerchantDetailDto, ProductSummaryDto } from '@dripplex/types';

import { CardGridSkeleton } from '@/components/marketplace/card-grid-skeleton';
import { ProductCard } from '@/components/marketplace/product-card';
import { RatingStars } from '@/components/marketplace/rating-stars';
import { formatDeliveryEstimate } from '@/lib/delivery-estimate';
import { describeSdkError, sdk } from '@/lib/sdk';

export default function MerchantMiniStorePage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const merchantId = params.id;

  const [merchant, setMerchant] = React.useState<MerchantDetailDto | null>(null);
  const [products, setProducts] = React.useState<ProductSummaryDto[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      sdk.merchants.get(merchantId),
      sdk.products.browse({ merchantId, sort: 'newest' }),
    ])
      .then(([merchantData, productResult]) => {
        if (!cancelled) {
          setMerchant(merchantData);
          setProducts(productResult.items);
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
  }, [merchantId]);

  if (error) {
    return (
      <div className="container py-10">
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      </div>
    );
  }

  if (!merchant) {
    return (
      <div className="container flex flex-col gap-6 py-10">
        <CardGridSkeleton count={1} />
      </div>
    );
  }

  const eta = formatDeliveryEstimate(merchant.distanceKm);

  return (
    <div className="flex flex-col">
      <div className="bg-muted relative h-40 w-full sm:h-56">
        {merchant.coverPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={merchant.coverPhotoUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="container -mt-10 flex flex-col gap-4 pb-10 sm:-mt-14">
        <div className="flex items-end gap-4">
          <div className="border-background bg-muted h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 sm:h-28 sm:w-28">
            {merchant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={merchant.logoUrl}
                alt={merchant.businessName}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          <div className="min-w-0 pb-2">
            <div className="flex items-center gap-1.5">
              <h1 className="font-display truncate text-2xl font-bold tracking-tight sm:text-3xl">
                {merchant.businessName}
              </h1>
              {merchant.verificationStatus === 'VERIFIED' ? (
                <BadgeCheck className="text-primary h-5 w-5 shrink-0" aria-label="Verified" />
              ) : null}
            </div>
            <RatingStars average={merchant.rating.average} count={merchant.rating.count} />
          </div>
        </div>

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="flex items-center gap-1">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            {merchant.address}, {merchant.city}
          </span>
          {eta ? (
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" aria-hidden="true" />
              {eta}
            </span>
          ) : null}
          {merchant.isOpenNow !== null ? (
            <Badge variant={merchant.isOpenNow ? 'success' : 'outline'}>
              {merchant.isOpenNow ? 'Open now' : 'Closed'}
            </Badge>
          ) : null}
        </div>

        {merchant.description ? <p className="max-w-2xl text-sm">{merchant.description}</p> : null}

        <div className="mt-4">
          <h2 className="font-display mb-4 text-xl font-semibold tracking-tight">Products</h2>
          {!products ? (
            <CardGridSkeleton />
          ) : products.length === 0 ? (
            <EmptyState
              title="No products yet"
              description="This merchant hasn't published any products yet."
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
