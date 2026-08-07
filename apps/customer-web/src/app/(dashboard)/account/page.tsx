import * as React from 'react';

import type { Metadata } from 'next';

import { AccountManagementFlow } from '@/components/auth/account-management-flow';

export const metadata: Metadata = {
  title: 'Manage Account',
  description: 'Control your DrippleX account.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AccountPage(): React.JSX.Element {
  return <AccountManagementFlow />;
}
