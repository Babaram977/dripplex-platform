import { Badge, EmptyState } from '@dripplex/ui';
import { formatRelativeTime } from '@dripplex/utils';
import * as React from 'react';

import type { LiveRideDto, LiveRideStatus } from '@dripplex/types';

const STATUS_LABEL: Record<LiveRideStatus, string> = {
  REQUESTED: 'Requested',
  SEARCHING: 'Searching for driver',
  DRIVER_ASSIGNED: 'Driver assigned',
  ARRIVED: 'Driver arrived',
  IN_PROGRESS: 'In progress',
};

/** Ordered so rides still waiting for a driver — the ones Operations most
 * needs to watch — sort first. */
const STATUS_SORT_ORDER: LiveRideStatus[] = [
  'REQUESTED',
  'SEARCHING',
  'DRIVER_ASSIGNED',
  'ARRIVED',
  'IN_PROGRESS',
];

function statusBadgeVariant(status: LiveRideStatus): 'outline' | 'accent' | 'success' {
  if (status === 'REQUESTED' || status === 'SEARCHING') return 'accent';
  if (status === 'IN_PROGRESS') return 'success';
  return 'outline';
}

/** DPX-OPS-001 Slice 1 — the live ride queue, read directly from `Ride` via
 * `OperationsRideQueueService` (`rides/` itself is never imported). */
export function RideQueueList({ rides }: { rides: LiveRideDto[] }): React.JSX.Element {
  if (rides.length === 0) {
    return (
      <EmptyState
        title="No live rides"
        description="No requested or in-progress rides right now."
      />
    );
  }

  const sorted = [...rides].sort(
    (a, b) => STATUS_SORT_ORDER.indexOf(a.status) - STATUS_SORT_ORDER.indexOf(b.status),
  );

  return (
    <div className="border-border/70 divide-border/70 divide-y overflow-hidden rounded-lg border">
      {sorted.map((ride) => (
        <div key={ride.rideId} className="flex flex-col gap-2 px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">{ride.customerName}</span>
            <Badge variant={statusBadgeVariant(ride.status)}>{STATUS_LABEL[ride.status]}</Badge>
          </div>
          <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span>{ride.driverName ?? 'No driver assigned yet'}</span>
            <span>{ride.pickupAddress ?? 'Pickup address unavailable'}</span>
            <span>Requested {formatRelativeTime(ride.requestedAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
