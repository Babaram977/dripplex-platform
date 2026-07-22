import * as React from 'react';

import type { Metadata } from 'next';

import {
  DashboardPlaceholder,
  dashboardPlaceholderMetadata,
} from '@/components/dashboard/dashboard-placeholder';

export const metadata: Metadata = dashboardPlaceholderMetadata(
  'Profile',
  'Manage your Dripplex customer profile.',
);

export default function ProfilePage(): React.JSX.Element {
  return (
    <DashboardPlaceholder
      title="Profile"
      description="View and update your account details, phone verification, and preferences."
    />
  );
}
