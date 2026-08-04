'use client';

import { Badge, Skeleton } from '@dripplex/ui';
import * as React from 'react';

import type { InspectionStatus } from '@dripplex/types';

import { useDriverInspections } from '@/hooks/use-driver-inspections';
import { formatDate } from '@/lib/format';

const STATUS_BADGE: Record<
  InspectionStatus,
  { variant: 'success' | 'outline'; className?: string }
> = {
  PASSED: { variant: 'success' },
  FAILED: { variant: 'outline', className: 'text-destructive border-destructive/40' },
  CANCELLED: { variant: 'outline', className: 'text-destructive border-destructive/40' },
  SCHEDULED: { variant: 'outline' },
};

export function InspectionHistory(): React.JSX.Element {
  const inspections = useDriverInspections();

  if (inspections.isLoading) {
    return <Skeleton className="h-16 w-full" />;
  }

  if (!inspections.data || inspections.data.length === 0) {
    return <p className="text-muted-foreground text-sm">No inspections scheduled yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {inspections.data.map((inspection) => (
        <div
          key={inspection.id}
          className="border-border/70 flex items-center justify-between rounded-md border p-3 text-sm"
        >
          <div>
            <p className="font-medium">Scheduled {formatDate(inspection.scheduledAt)}</p>
            {inspection.completedAt ? (
              <p className="text-muted-foreground text-xs">
                Completed {formatDate(inspection.completedAt)}
              </p>
            ) : null}
          </div>
          <Badge {...STATUS_BADGE[inspection.status]}>{inspection.status}</Badge>
        </div>
      ))}
    </div>
  );
}
