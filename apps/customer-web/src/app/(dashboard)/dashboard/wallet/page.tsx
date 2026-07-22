import * as React from 'react';

import type { Metadata } from 'next';

import {
  DashboardPlaceholder,
  dashboardPlaceholderMetadata,
} from '@/components/dashboard/dashboard-placeholder';

export const metadata: Metadata = dashboardPlaceholderMetadata(
  'Wallet',
  'Dripplex wallet balance and transactions.',
);

export default function WalletPage(): React.JSX.Element {
  return (
    <DashboardPlaceholder
      title="Wallet"
      description="Balances, top-ups, and transaction history will ship with commerce modules."
    />
  );
}
