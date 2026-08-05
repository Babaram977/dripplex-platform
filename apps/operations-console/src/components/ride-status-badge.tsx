import { Badge } from '@dripplex/ui';
import * as React from 'react';

import type { RideStatus } from '@dripplex/types';

const STATUS_LABEL: Record<RideStatus, string> = {
  REQUESTED: 'Requested',
  SEARCHING: 'Searching for driver',
  DRIVER_ASSIGNED: 'Driver assigned',
  ARRIVED: 'Driver arrived',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_DRIVERS_FOUND: 'No drivers found',
};

type BadgeVariant = React.ComponentProps<typeof Badge>['variant'];

function variantFor(status: RideStatus): BadgeVariant {
  switch (status) {
    case 'REQUESTED':
    case 'SEARCHING':
      return 'accent';
    case 'IN_PROGRESS':
    case 'DRIVER_ASSIGNED':
    case 'ARRIVED':
      return 'success';
    case 'COMPLETED':
      return 'secondary';
    case 'CANCELLED':
    case 'NO_DRIVERS_FOUND':
      return 'outline';
    default:
      return 'outline';
  }
}

/** DPX-OPS-001 Slice 3 — the full `RideStatus` (8 values), unlike Slice 1's
 * `RideQueueList` which only needs the 5 "live" statuses. CANCELLED and
 * NO_DRIVERS_FOUND get their own labels rather than a shared "settled"
 * one — the Slice 3 reality audit's own finding that these are distinct,
 * both-real outcomes the console must not conflate. */
export function RideStatusBadge({ status }: { status: RideStatus }): React.JSX.Element {
  const isException = status === 'CANCELLED' || status === 'NO_DRIVERS_FOUND';
  return (
    <Badge
      variant={variantFor(status)}
      className={isException ? 'border-destructive/40 bg-destructive/10 text-destructive' : ''}
    >
      {STATUS_LABEL[status]}
    </Badge>
  );
}
