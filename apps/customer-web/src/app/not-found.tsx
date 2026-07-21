import Link from 'next/link';
import * as React from 'react';

import { Button } from '@/components/ui/button';

export default function NotFound(): React.JSX.Element {
  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <p className="text-accent text-sm font-semibold uppercase tracking-[0.2em]">404</p>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-muted-foreground max-w-md text-sm">
        The page you requested is not part of the Dripplex customer shell.
      </p>
      <Button asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
