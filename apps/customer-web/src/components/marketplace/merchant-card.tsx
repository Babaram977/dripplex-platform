import { Badge, Card } from '@dripplex/ui';
import { BadgeCheck, Clock, MapPin } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { RatingStars } from './rating-stars';

import type { MerchantSummaryDto } from '@dripplex/types';

import { formatDeliveryEstimate } from '@/lib/delivery-estimate';

interface MerchantCardProps {
  merchant: MerchantSummaryDto;
}

export function MerchantCard({ merchant }: MerchantCardProps): React.JSX.Element {
  const eta = formatDeliveryEstimate(merchant.distanceKm);

  return (
    <Link href={`/marketplace/merchants/${merchant.id}`}>
      <Card className="hover:shadow-elevation-2 overflow-hidden transition-shadow">
        <div className="bg-muted relative h-24 w-full">
          {merchant.coverPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={merchant.coverPhotoUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : null}
          {merchant.isOpenNow !== null ? (
            <Badge
              variant={merchant.isOpenNow ? 'success' : 'outline'}
              className="absolute right-2 top-2"
            >
              {merchant.isOpenNow ? 'Open' : 'Closed'}
            </Badge>
          ) : null}
        </div>
        <div className="flex gap-3 p-3">
          <div className="border-background bg-muted -mt-8 h-14 w-14 shrink-0 overflow-hidden rounded-full border-2">
            {merchant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={merchant.logoUrl}
                alt={merchant.businessName}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <p className="truncate text-sm font-medium">{merchant.businessName}</p>
              {merchant.verificationStatus === 'VERIFIED' ? (
                <BadgeCheck
                  className="text-primary h-4 w-4 shrink-0"
                  aria-label="Verified merchant"
                />
              ) : null}
            </div>
            <RatingStars average={merchant.rating.average} count={merchant.rating.count} />
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                {merchant.distanceKm !== null
                  ? `${merchant.distanceKm.toFixed(1)} km`
                  : `${merchant.city}, ${merchant.state}`}
              </span>
              {eta ? (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {eta}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
