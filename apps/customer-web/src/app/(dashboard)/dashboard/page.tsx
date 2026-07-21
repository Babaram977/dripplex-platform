import * as React from 'react';

import type { Metadata } from 'next';

import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Dripplex customer dashboard shell.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardPage(): React.JSX.Element {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          This is the customer shell. Marketplace, wallet, orders, and mobility modules will plug in
          here later.
        </p>
      </div>
      <EmptyState
        title="No modules connected yet"
        description="The dashboard chrome is ready — top header, sidebar, mobile navigation, and content area are in place for future product surfaces."
      />
    </div>
  );
}
