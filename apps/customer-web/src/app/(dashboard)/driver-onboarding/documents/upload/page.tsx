import * as React from 'react';

import type { Metadata } from 'next';

import { DriverKycUpload } from '@/components/driver/driver-kyc-upload';

export const metadata: Metadata = {
  title: 'Upload Documents',
  description: 'Upload your KYC documents as a DrippleX driver.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function DriverKycUploadPage(): React.JSX.Element {
  return <DriverKycUpload />;
}
