'use client';

import * as React from 'react';

import { ActionButton, RideHeader } from '../ride-ui';

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

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <RideHeader onBack={onBack} title="Rate Your Ride" />
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <div className="mb-6 flex flex-col items-center">
          <div
            className="mb-3 flex h-20 w-20 items-center justify-center rounded-3xl text-2xl font-bold"
            style={{
              background: 'linear-gradient(135deg,#176B30,#2BAC52)',
              color: '#fff',
              fontFamily: "'Poppins',sans-serif",
            }}
          >
            {receipt.data?.driver ? receipt.data.driver.name.slice(0, 1).toUpperCase() : '🚗'}
          </div>
          <p
            className="text-[18px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
          >
            {receipt.data?.driver?.name ?? 'Your driver'}
          </p>
        </div>
        <div className="mb-6 flex justify-center gap-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setStars(n);
              }}
              style={{ fontSize: 36, filter: n <= stars ? 'none' : 'grayscale(1) opacity(.3)' }}
            >
              ⭐
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(event) => {
            setComment(event.target.value);
          }}
          placeholder="Tell us about your experience..."
          rows={3}
          className="w-full resize-none rounded-2xl px-4 py-3 outline-none"
          style={{
            background: '#112238',
            border: '1px solid rgba(255,255,255,.08)',
            fontFamily: "'Inter',sans-serif",
            fontSize: 14,
            color: '#fff',
          }}
        />
        {rateDriver.isError ? (
          <p
            className="mt-3 text-[13px]"
            style={{ fontFamily: "'Inter',sans-serif", color: '#EF4444' }}
          >
            Couldn&apos;t submit your rating. Try again.
          </p>
        ) : null}
      </div>
      <div className="px-5 pb-8">
        <ActionButton
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
