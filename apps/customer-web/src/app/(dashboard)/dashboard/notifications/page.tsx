import * as React from 'react';

import type { Metadata } from 'next';

import {
  DashboardPlaceholder,
  dashboardPlaceholderMetadata,
} from '@/components/dashboard/dashboard-placeholder';

export const metadata: Metadata = dashboardPlaceholderMetadata(
  'Notifications',
  'Your Dripplex notification centre.',
);

export default function NotificationsPage(): React.JSX.Element {
  return (
    <DashboardPlaceholder
      title="Notifications"
      description="Order updates, wallet alerts, and platform messages will appear here."
    />
  );
}
