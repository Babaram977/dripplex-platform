'use client';

import { Button } from '@dripplex/ui';
import * as React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  return (
    <html lang="en">
      <body className="bg-background text-foreground flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
        <h1 className="font-display text-2xl font-semibold">Something went wrong</h1>
        <p className="text-muted-foreground max-w-md text-center text-sm">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <Button type="button" onClick={reset}>
          Try again
        </Button>
      </body>
    </html>
  );
}
