'use client';

import { Skeleton } from '@dripplex/ui';
import * as React from 'react';

import { useDriverPerformanceStats } from '@/hooks/use-driver-profile';

export function PerformanceSummary(): React.JSX.Element | null {
  const stats = useDriverPerformanceStats();

  if (stats.isLoading) {
    return <Skeleton className="h-16 w-full" />;
  }

  if (!stats.data) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div>
        <p className="text-muted-foreground text-xs">Completed trips</p>
        <p className="text-lg font-semibold">{stats.data.completedTrips}</p>
      </div>
      <div>
        <p className="text-muted-foreground text-xs">Average rating</p>
        <p className="text-lg font-semibold">
          {stats.data.averageRating !== null
            ? `${stats.data.averageRating.toFixed(2)} ★ (${String(stats.data.ratingCount)})`
            : 'No ratings yet'}
        </p>
      </div>
    </div>
  );
}
