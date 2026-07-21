// Next.js apps may wrap with Link at the app layer
import { cn } from '@dripplex/utils';
import * as React from 'react';

interface DripplexLogoProps {
  className?: string;
  showWordmark?: boolean;
  href?: string;
}

export function DripplexLogo({
  className,
  showWordmark = true,
  href = '/',
}: DripplexLogoProps): React.JSX.Element {
  const content = (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        aria-hidden="true"
        className="bg-primary text-primary-foreground shadow-elevation-1 relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-md"
      >
        <span className="font-display text-lg font-bold tracking-tight">D</span>
        <span className="bg-accent absolute inset-x-0 bottom-0 h-1" />
      </span>
      {showWordmark ? (
        <span className="font-display text-foreground text-xl font-bold tracking-tight">
          Dripplex
        </span>
      ) : null}
    </span>
  );

  return (
    <a href={href} aria-label="Dripplex home" className="rounded-md focus-visible:outline-none">
      {content}
    </a>
  );
}
