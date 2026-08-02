'use client';

import { Badge, Card, CardContent, CardHeader, CardTitle } from '@dripplex/ui';
import * as React from 'react';

import { useActiveRide } from '@/hooks/rides/use-active-ride';
import { formatNaira } from '@/lib/format';

const STATUS_LABEL: Record<string, string> = {
  DRIVER_ASSIGNED: 'Heading to pickup',
  ARRIVED: 'Waiting at pickup',
  IN_PROGRESS: 'Trip in progress',
};

export function ActiveTripSummaryCard(): React.JSX.Element | null {
  const activeRide = useActiveRide();
  const ride = activeRide.data;

  if (!ride) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Current trip</CardTitle>
        <Badge variant="success">{STATUS_LABEL[ride.status] ?? ride.status}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="bg-primary mt-1.5 h-2 w-2 flex-shrink-0 rounded-full" />
            <span>{ride.pickupAddress ?? 'Pickup location on the map'}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="bg-muted-foreground mt-1.5 h-2 w-2 flex-shrink-0 rounded-full" />
            <span>{ride.dropoffAddress ?? 'Dropoff location on the map'}</span>
          </div>
        </div>
        <div className="border-border/70 flex items-center justify-between rounded-md border border-dashed px-4 py-3">
          <span className="text-sm font-medium">Fare</span>
          <span className="font-display text-lg font-semibold">{formatNaira(ride.totalFare)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
