'use client';

import { Badge, Button } from '@dripplex/ui';
import * as React from 'react';

import type { RideDto } from '@dripplex/types';

import { useConfirmCash } from '@/hooks/rides/use-trip-actions';
import { formatNaira } from '@/lib/format';

/** Reused for both the just-completed trip screen and (Slice 4) Ride
 * History detail — every field here comes straight off RideDto, no
 * separate receipt endpoint needed (see docs/DRIVER-PORTAL-SLICE-3.md). */
export function TripFareSummary({ ride }: { ride: RideDto }): React.JSX.Element {
  const confirmCash = useConfirmCash();
  const [confirmed, setConfirmed] = React.useState(false);
  const needsCashConfirmation =
    ride.paymentMethod === 'CASH' && ride.paymentStatus !== 'PAID' && !confirmed;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Base fare</span>
          <span>{formatNaira(ride.baseFare)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Distance fare</span>
          <span>{formatNaira(ride.distanceFare)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Time fare</span>
          <span>{formatNaira(ride.timeFare)}</span>
        </div>
        {ride.tipAmount ? (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tip</span>
            <span>{formatNaira(ride.tipAmount)}</span>
          </div>
        ) : null}
        <div className="border-border/70 flex justify-between border-t pt-1.5 font-medium">
          <span>Total fare</span>
          <span>{formatNaira(ride.totalFare)}</span>
        </div>
        {ride.driverEarning !== null ? (
          <div className="flex justify-between font-medium">
            <span>Your earning</span>
            <span>{formatNaira(ride.driverEarning)}</span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">Payment method</span>
        <Badge variant="outline">{ride.paymentMethod ?? 'Unknown'}</Badge>
      </div>

      {needsCashConfirmation ? (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs">
            Confirm once you&apos;ve collected cash from the passenger.
          </p>
          <Button
            type="button"
            onClick={() => {
              confirmCash.mutate(ride.id, {
                onSuccess: () => {
                  setConfirmed(true);
                },
              });
            }}
            disabled={confirmCash.isPending}
          >
            Confirm cash received
          </Button>
          {confirmCash.isError ? (
            <p className="text-destructive text-xs">Couldn&apos;t confirm payment. Try again.</p>
          ) : null}
        </div>
      ) : null}

      {ride.paymentMethod === 'CASH' && (ride.paymentStatus === 'PAID' || confirmed) ? (
        <Badge variant="success" className="w-fit">
          Cash payment confirmed
        </Badge>
      ) : null}
    </div>
  );
}
