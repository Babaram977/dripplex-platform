import * as React from 'react';

import type { Metadata } from 'next';

import {
  DashboardPlaceholder,
  dashboardPlaceholderMetadata,
} from '@/components/dashboard/dashboard-placeholder';

export const metadata: Metadata = dashboardPlaceholderMetadata(
  'Orders',
  'Your Dripplex order history and tracking.',
);

export default function OrdersPage(): React.JSX.Element {
  return (
    <DashboardPlaceholder
      title="Orders"
      description="Order list, details, and live tracking arrive with marketplace checkout."
    />
  );
}
