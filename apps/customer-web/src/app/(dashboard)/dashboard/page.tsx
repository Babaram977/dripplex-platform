import * as React from 'react';

import type { Metadata } from 'next';

import { CustomerBackendStatus } from '@/components/dashboard/customer-backend-status';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'DrippleX customer dashboard — live Backend Core session.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardPage(): React.JSX.Element {
  return <CustomerBackendStatus />;
}
