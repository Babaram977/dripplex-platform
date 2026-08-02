import { cn } from '@dripplex/utils';
import * as React from 'react';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–1 fraction complete. Values outside that range are clamped. */
  value: number;
  /** Visual track color intent — defaults to the primary brand color. */
  indicatorClassName?: string;
}

export function Progress({
  value,
  className,
  indicatorClassName,
  ...props
}: ProgressProps): React.JSX.Element {
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('bg-secondary h-2 w-full overflow-hidden rounded-full', className)}
      {...props}
    >
      <div
        className={cn(
          'bg-primary h-full rounded-full transition-[width] duration-700 ease-out',
          indicatorClassName,
        )}
        style={{ width: `${String(clamped * 100)}%` }}
      />
    </div>
  );
}
