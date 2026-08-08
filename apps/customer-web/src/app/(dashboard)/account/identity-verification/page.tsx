import * as React from 'react';

import type { Metadata } from 'next';

import { IdentityVerificationFlow } from '@/components/auth/identity-verification-flow';

export const metadata: Metadata = {
  title: 'Identity Verification',
  description: 'Verify your identity to unlock the full DrippleX experience.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function IdentityVerificationPage(): React.JSX.Element {
  return <IdentityVerificationFlow />;
}
