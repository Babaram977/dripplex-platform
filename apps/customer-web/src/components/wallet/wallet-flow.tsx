'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

import { WalletHomeScreen } from './screens/wallet-home-screen';

/**
 * DPX-100 Wallet Slice 1 (Home only). Will grow into the same
 * flat-screen-union pattern as `ride-flow.tsx` once a second screen
 * exists (Slice 2) — a single-case switch over one literal screen name
 * is premature abstraction until then.
 */
export function WalletFlow(): React.JSX.Element {
  const router = useRouter();
  return (
    <WalletHomeScreen
      onBack={() => {
        router.push('/dashboard');
      }}
    />
  );
}
