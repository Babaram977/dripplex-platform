import { Badge, EmptyState } from '@dripplex/ui';
import { formatRelativeTime } from '@dripplex/utils';
import * as React from 'react';

import type { OperationsRideAllocationDto, RideOfferStatus } from '@dripplex/types';

const STATUS_LABEL: Record<RideOfferStatus, string> = {
  PENDING: 'Pending response',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  EXPIRED: 'Expired unanswered',
};

type BadgeVariant = React.ComponentProps<typeof Badge>['variant'];

function statusVariant(status: RideOfferStatus): BadgeVariant {
  if (status === 'ACCEPTED') return 'success';
  if (status === 'PENDING') return 'accent';
  return 'outline';
}

/** DPX-OPS-001 Slice 3 — the founder's "driver allocation history": who
 * was offered this ride, in what order, and what happened. Reads
 * `RideOffer` rows directly, already ordered `offeredAt` ascending by the
 * backend — the sequence dispatch actually tried. */
export function RideAllocationTimeline({
  allocation,
}: {
  allocation: OperationsRideAllocationDto;
}): React.JSX.Element {
  if (allocation.offers.length === 0) {
    return (
      <EmptyState
        title="No dispatch attempts yet"
        description="This ride hasn't been offered to a driver."
      />
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {allocation.offers.map((offer, index) => (
        <li key={offer.id} className="flex items-start gap-3 text-sm">
          <span className="text-muted-foreground w-5 shrink-0 tabular-nums">{index + 1}.</span>
          <div className="flex flex-1 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{offer.driverName}</span>
              <Badge variant={statusVariant(offer.status)}>{STATUS_LABEL[offer.status]}</Badge>
              {offer.driverId === allocation.currentDriverId ? (
                <Badge variant="secondary">Current driver</Badge>
              ) : null}
            </div>
            <p className="text-muted-foreground text-xs">
              Offered {formatRelativeTime(offer.offeredAt)}
              {offer.respondedAt ? ` · responded ${formatRelativeTime(offer.respondedAt)}` : ''}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
