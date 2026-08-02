'use client';

import * as React from 'react';

import { RideHeader, StatusBanner } from '../ride-ui';

import { useRide, useRideTracking } from '@/hooks/rides';

/**
 * Generated — no real `CashPaymentScreen` was received. Extends the locked
 * design language (RideHeader + StatusBanner, same as every other screen).
 *
 * Not a redesign choice: verified `ride-payment.service.ts`'s `selectCash()`
 * only records the customer's intent (`paymentMethod: CASH`) — it does NOT
 * mark the ride paid. That only happens when the *driver* confirms cash
 * receipt via `confirmCash()` (a driver-only action, never customer-
 * reachable). A mock that shows "Cash payment confirmed!" the instant the
 * customer taps a button would be fabricating a transition the backend
 * hasn't made yet, so this screen shows an honest waiting state instead,
 * watching the real `paymentStatus` field (WS `ride:payment` push, patched
 * by useRideTracking, plus a poll fallback for the same reason
 * useRideStatusTransition polls elsewhere).
 */
export function CashPaymentScreen({
  rideId,
  onBack,
  onConfirmed,
}: {
  rideId: string;
  onBack: () => void;
  onConfirmed: () => void;
}): React.JSX.Element {
  const ride = useRide(rideId);
  useRideTracking(rideId);

  React.useEffect(() => {
    if (ride.data?.paymentStatus === 'PAID') {
      onConfirmed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when paymentStatus itself changes
  }, [ride.data?.paymentStatus]);

  React.useEffect(() => {
    if (ride.data?.paymentStatus === 'PAID') return undefined;
    const interval = setInterval(() => {
      void ride.refetch();
    }, 4000);
    return () => {
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-arm only when paymentStatus changes
  }, [ride.data?.paymentStatus]);

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <RideHeader onBack={onBack} title="Cash Payment" />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full text-3xl"
          style={{ background: 'rgba(245,158,11,.12)' }}
        >
          💵
        </div>
        <StatusBanner
          title={ride.data ? `Pay ₦${ride.data.totalFare.toLocaleString()} in cash` : 'Pay in cash'}
          subtitle="Hand the fare to your driver. This screen updates automatically once they confirm receiving it."
        />
      </div>
    </div>
  );
}
