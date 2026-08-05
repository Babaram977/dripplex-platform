import { EmptyState } from '@dripplex/ui';
import { formatRelativeTime } from '@dripplex/utils';
import * as React from 'react';

import type { OperationsRideTrackingDto } from '@dripplex/types';

/** DPX-OPS-001 Slice 3 — trip monitoring. Answers "where is the trip right
 * now?" from the same `RideTracking` breadcrumb MAPS-UI already renders on
 * a map for the ride's own customer/driver — this view is deliberately
 * text-first rather than a second full map implementation, since the last
 * known coordinate plus how stale it is answers the operator's question
 * directly. A map view is a reasonable future enhancement, not something
 * this slice needed to duplicate MAPS-UI to ship. */
export function TripTrackingPanel({
  tracking,
}: {
  tracking: OperationsRideTrackingDto;
}): React.JSX.Element {
  if (tracking.points.length === 0) {
    return (
      <EmptyState
        title="No location updates yet"
        description="This ride hasn't sent any tracking points."
      />
    );
  }

  const latest = tracking.points[tracking.points.length - 1];
  if (!latest) {
    return (
      <EmptyState
        title="No location updates yet"
        description="This ride hasn't sent any tracking points."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">
          {latest.latitude.toFixed(5)}, {latest.longitude.toFixed(5)}
        </span>
        <span className="text-muted-foreground text-xs">
          Last updated {formatRelativeTime(latest.at)}
        </span>
      </div>
      <p className="text-muted-foreground text-xs">
        {tracking.points.length} location update{tracking.points.length === 1 ? '' : 's'} recorded
        {latest.speed !== null ? ` · last speed ${latest.speed.toFixed(1)} m/s` : ''}
      </p>
    </div>
  );
}
