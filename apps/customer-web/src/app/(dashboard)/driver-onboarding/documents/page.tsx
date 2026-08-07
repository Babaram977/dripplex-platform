import * as React from 'react';

import type { Metadata } from 'next';

import { DriverKycStatus } from '@/components/driver/driver-kyc-status';

export const metadata: Metadata = {
  title: 'KYC Status',
  description: 'Track your KYC verification status as a DrippleX driver.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function DriverKycStatusPage(): React.JSX.Element {
  return <DriverKycStatus />;
}
