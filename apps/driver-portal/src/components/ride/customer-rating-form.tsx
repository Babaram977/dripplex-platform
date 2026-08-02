'use client';

import { Button, Textarea } from '@dripplex/ui';
import { Star } from 'lucide-react';
import * as React from 'react';

import { useRateCustomer } from '@/hooks/rides/use-trip-actions';

export function CustomerRatingForm({
  rideId,
  onSubmitted,
}: {
  rideId: string;
  onSubmitted: () => void;
}): React.JSX.Element {
  const [stars, setStars] = React.useState(5);
  const [comment, setComment] = React.useState('');
  const rateCustomer = useRateCustomer();

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">Rate your passenger</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${String(n)} star${n === 1 ? '' : 's'}`}
            onClick={() => {
              setStars(n);
            }}
          >
            <Star
              className={
                n <= stars ? 'fill-primary text-primary h-7 w-7' : 'text-muted-foreground h-7 w-7'
              }
            />
          </button>
        ))}
      </div>
      <Textarea
        value={comment}
        onChange={(event) => {
          setComment(event.target.value);
        }}
        placeholder="Optional comment"
        rows={3}
      />
      {rateCustomer.isError ? (
        <p className="text-destructive text-xs">Couldn&apos;t submit your rating. Try again.</p>
      ) : null}
      <Button
        type="button"
        onClick={() => {
          rateCustomer.mutate(
            {
              rideId,
              body: { rating: stars, ...(comment.trim() ? { comment: comment.trim() } : {}) },
            },
            { onSuccess: onSubmitted },
          );
        }}
        disabled={rateCustomer.isPending}
      >
        Submit rating
      </Button>
    </div>
  );
}
