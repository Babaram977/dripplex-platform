'use client';

import { Skeleton } from '@dripplex/ui';
import { Star } from 'lucide-react';
import * as React from 'react';

import { useRideRatings } from '@/hooks/rides/use-ride-ratings';

function StarRow({ rating }: { rating: number }): React.JSX.Element {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={
            n <= rating ? 'fill-primary text-primary h-4 w-4' : 'text-muted-foreground h-4 w-4'
          }
        />
      ))}
    </div>
  );
}

export function RideRatingsDisplay({ rideId }: { rideId: string }): React.JSX.Element {
  const ratings = useRideRatings(rideId);

  if (ratings.isLoading) {
    return <Skeleton className="h-10 w-full" />;
  }
  if (!ratings.data || ratings.data.length === 0) {
    return <p className="text-muted-foreground text-sm">No ratings recorded for this trip yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {ratings.data.map((rating) => (
        <div key={rating.id} className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">
            {rating.raterRole === 'CUSTOMER' ? 'Passenger rated you' : 'You rated the passenger'}
          </span>
          <StarRow rating={rating.rating} />
        </div>
      ))}
    </div>
  );
}
