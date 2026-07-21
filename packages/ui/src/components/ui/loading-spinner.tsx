import { cn } from '@dripplex/utils';
import * as React from 'react';

interface LoadingSpinnerProps {
  className?: string;
  label?: string;
}

export function LoadingSpinner({
  className,
  label = 'Loading',
}: LoadingSpinnerProps): React.JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('text-muted-foreground inline-flex items-center gap-2 text-sm', className)}
    >
      <span
        className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-r-transparent"
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  );
}
