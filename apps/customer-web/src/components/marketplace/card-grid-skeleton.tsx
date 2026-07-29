import { Skeleton } from '@dripplex/ui';
import * as React from 'react';

interface CardGridSkeletonProps {
  count?: number;
}

export function CardGridSkeleton({ count = 8 }: CardGridSkeletonProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}
