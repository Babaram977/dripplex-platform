import { cn } from '@dripplex/utils';
import * as React from 'react';

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div
      className={cn('bg-muted relative overflow-hidden rounded-md', className)}
      aria-hidden="true"
      {...props}
    >
      <div className="animate-shimmer via-background/40 absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent to-transparent" />
    </div>
  );
}
