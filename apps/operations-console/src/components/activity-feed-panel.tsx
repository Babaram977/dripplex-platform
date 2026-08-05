import { EmptyState } from '@dripplex/ui';
import { formatRelativeTime } from '@dripplex/utils';
import * as React from 'react';

import type { ActivityFeedItemDto } from '@dripplex/types';

const ICON: Record<ActivityFeedItemDto['type'], string> = {
  SOS_TRIGGERED: '🔴',
  INCIDENT_REPORTED: '⚠️',
  INSPECTION_COMPLETED: '✅',
  SHIFT_STARTED: '🟢',
  SHIFT_ENDED: '⏹️',
  RIDE_CANCELLED: '🚫',
};

/** DPX-OPS-001 Slice 2 — the founder's "one addition": a Live Activity
 * Feed on the dashboard, so operators get situational awareness without
 * switching screens. Composed read-only from existing tables — see
 * `OperationsDashboardService.getActivityFeed()`'s own doc comment for
 * the one deliberate gap (driver online/offline has no history). */
export function ActivityFeedPanel({ items }: { items: ActivityFeedItemDto[] }): React.JSX.Element {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No recent activity"
        description="SOS alerts, incidents, inspections, shifts, and ride cancellations will show up here."
      />
    );
  }

  return (
    <ul className="divide-border/70 divide-y">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-3 py-2.5">
          <span aria-hidden="true" className="text-base leading-none">
            {ICON[item.type]}
          </span>
          <div>
            <p className="text-sm">{item.message}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {formatRelativeTime(item.occurredAt)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
