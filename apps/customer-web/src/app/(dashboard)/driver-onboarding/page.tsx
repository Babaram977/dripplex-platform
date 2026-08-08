import * as React from 'react';

import type { Metadata } from 'next';

import { DriverOnboardingStatus } from '@/components/driver/driver-onboarding-status';

export const metadata: Metadata = {
  title: 'Driver Onboarding',
  description: 'Become a DrippleX driver and track your onboarding status.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function DriverOnboardingPage(): React.JSX.Element {
  return <DriverOnboardingStatus />;
}
