import { cn } from '@dripplex/utils';
import * as React from 'react';

import { dripplexMarkSvg } from '../../brand/dripplex-mark';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
  showBrandMark?: boolean;
}

export function EmptyState({
  title,
  description,
  action,
  className,
  showBrandMark = true,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'border-border bg-card/50 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center',
        className,
      )}
    >
      {showBrandMark ? (
        <span
          aria-hidden="true"
          className="mb-1 flex h-12 w-12 items-center justify-center overflow-hidden rounded-md opacity-90"
          dangerouslySetInnerHTML={{ __html: dripplexMarkSvg }}
        />
      ) : null}
      <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
      <p className="text-muted-foreground max-w-md text-sm">{description}</p>
      {action}
    </div>
  );
}
