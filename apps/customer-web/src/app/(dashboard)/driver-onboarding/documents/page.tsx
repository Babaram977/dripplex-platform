import * as React from 'react';

import type { Metadata } from 'next';

import { DriverKycDocuments } from '@/components/driver/driver-kyc-documents';

export const metadata: Metadata = {
  title: 'KYC Documents',
  description: 'Submit your KYC documents as a DrippleX driver.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function DriverDocumentsPage(): React.JSX.Element {
  return <DriverKycDocuments />;
}
