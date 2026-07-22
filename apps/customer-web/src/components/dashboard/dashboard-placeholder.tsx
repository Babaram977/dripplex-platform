import { EmptyState } from '@dripplex/ui';
import Link from 'next/link';
import * as React from 'react';

import type { Metadata } from 'next';

interface DashboardPlaceholderProps {
  title: string;
  description: string;
  /** Shown as secondary note — Program B1 shell only */
  nextProgram?: string;
}

export function dashboardPlaceholderMetadata(title: string, description: string): Metadata {
  return {
    title,
    description,
    robots: { index: false, follow: false },
  };
}

export function DashboardPlaceholder({
  title,
  description,
  nextProgram = 'Program B2',
}: DashboardPlaceholderProps): React.JSX.Element {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <EmptyState
        title={`${title} is coming soon`}
        description={`This surface is reserved for ${nextProgram}. Your session is live against Backend Core — marketplace and commerce modules ship next.`}
        action={
          <Link
            href="/dashboard"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors"
          >
            Back to overview
          </Link>
        }
      />
    </div>
  );
}
