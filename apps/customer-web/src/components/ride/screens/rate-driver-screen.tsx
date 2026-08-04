'use client';

import {
  SuperAppRideActionButton,
  SuperAppRideDriverIdentity,
  SuperAppRideHeader,
  SuperAppRideStarRating,
  SuperAppRideTextarea,
  useSuperAppFonts,
} from '@dripplex/ui';
import * as React from 'react';

import { useRateDriver, useRideReceipt } from '@/hooks/rides';

/**
 * Real source had a freeform tag-chip picker ("Safe driving", "Friendly",
 * etc.) alongside stars + comment. `RateRideRequest` (packages/types) has
 * no field for freeform tags — only `rating`, `comment`, and a fixed
 * `categoryRatings` structure (driving/cleanliness/professionalism/
 * behaviour/waitingTime/paymentExperience). Rather than invent a mapping
 * from arbitrary tag labels onto that structure (which would be guessing
 * at meaning the backend never defined), the tag picker is dropped and
 * only the two fields the backend actually accepts are wired — adapting
 * the UI to the backend, not the other way around.
 */
export function RateDriverScreen({
  rideId,
  onBack,
  onSubmit,
}: {
  rideId: string;
  onBack: () => void;
  onSubmit: () => void;
}): React.JSX.Element {
  const receipt = useRideReceipt(rideId);
  const [stars, setStars] = React.useState(5);
  const [comment, setComment] = React.useState('');
  const rateDriver = useRateDriver();
  const { body } = useSuperAppFonts();

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <SuperAppRideHeader onBack={onBack} title="Rate Your Ride" />
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <SuperAppRideDriverIdentity driverName={receipt.data?.driver?.name} layout="column" />
        <SuperAppRideStarRating value={stars} onChange={setStars} />
        <SuperAppRideTextarea
          value={comment}
          onChange={setComment}
          placeholder="Tell us about your experience..."
          rows={3}
        />
        {rateDriver.isError ? (
          <p className={`mt-3 text-[13px] ${body}`} style={{ color: '#EF4444' }}>
            Couldn&apos;t submit your rating. Try again.
          </p>
        ) : null}
      </div>
      <div className="px-5 pb-8">
        <SuperAppRideActionButton
          label="Submit Rating"
          loading={rateDriver.isPending}
          onClick={() => {
            rateDriver.mutate(
              {
                rideId,
                body: { rating: stars, ...(comment.trim() ? { comment: comment.trim() } : {}) },
              },
              { onSuccess: onSubmit },
            );
          }}
        />
      </div>
    </div>
  );
}
