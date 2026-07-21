'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-muted-foreground max-w-md text-sm">
        {error.message || 'An unexpected error occurred while loading this page.'}
      </p>
      <Button type="button" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
