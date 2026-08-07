import * as React from 'react';

import type { Metadata } from 'next';

import { DriverVehicleForm } from '@/components/driver/driver-vehicle-form';

export const metadata: Metadata = {
  title: 'Vehicle Registration',
  description: 'Register your vehicle as a DrippleX driver.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function DriverVehiclePage(): React.JSX.Element {
  return <DriverVehicleForm />;
}
