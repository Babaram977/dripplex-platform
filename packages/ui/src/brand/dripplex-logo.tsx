// Next.js apps may wrap with Link at the app layer
import { cn } from '@dripplex/utils';
import * as React from 'react';

import { dripplexMarkSvg } from './dripplex-mark';
import { DRIPPLEX_BRAND } from './tokens';

interface DripplexLogoProps {
  className?: string;
  showWordmark?: boolean;
  href?: string;
  /** When true, wordmark uses currentColor (for navy/emerald brand panels). */
  invertWordmark?: boolean;
}

export function DripplexLogo({
  className,
  showWordmark = true,
  href = '/',
  invertWordmark = false,
}: DripplexLogoProps): React.JSX.Element {
  const content = (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        aria-hidden="true"
        className="shadow-elevation-1 relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md"
        dangerouslySetInnerHTML={{ __html: dripplexMarkSvg }}
      />
      {showWordmark ? (
        <span
          className={cn(
            'font-display text-xl font-bold tracking-tight',
            invertWordmark ? 'text-inherit' : 'text-foreground',
          )}
        >
          {DRIPPLEX_BRAND.name}
        </span>
      ) : null}
    </span>
  );

  return (
    <a
      href={href}
      aria-label={`${DRIPPLEX_BRAND.name} home`}
      className="rounded-md focus-visible:outline-none"
    >
      {content}
    </a>
  );
}

export function DripplexTagline({ className }: { className?: string }): React.JSX.Element {
  return (
    <span className={cn('font-display tracking-tight', className)}>{DRIPPLEX_BRAND.tagline}</span>
  );
}
