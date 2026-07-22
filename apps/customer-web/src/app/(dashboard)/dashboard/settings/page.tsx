import * as React from 'react';

import type { Metadata } from 'next';

import {
  DashboardPlaceholder,
  dashboardPlaceholderMetadata,
} from '@/components/dashboard/dashboard-placeholder';

export const metadata: Metadata = dashboardPlaceholderMetadata(
  'Settings',
  'Account and app preferences.',
);

export default function SettingsPage(): React.JSX.Element {
  return (
    <DashboardPlaceholder
      title="Settings"
      description="Security, notification preferences, and theme controls will expand here."
    />
  );
}
