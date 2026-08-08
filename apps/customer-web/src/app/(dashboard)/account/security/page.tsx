import * as React from 'react';

import type { Metadata } from 'next';

import { SecurityCenterFlow } from '@/components/auth/security-center-flow';

export const metadata: Metadata = {
  title: 'Security Center',
  description: 'Your account protection overview.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function SecurityCenterPage(): React.JSX.Element {
  return <SecurityCenterFlow />;
}
