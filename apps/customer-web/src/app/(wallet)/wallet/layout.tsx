'use client';

import { NAVY_DEEP, SuperAppFontProvider } from '@dripplex/ui';
import { Inter, Poppins } from 'next/font/google';
import * as React from 'react';

import { DashboardAuthGate } from '@/components/auth/dashboard-auth-gate';

const poppins = Poppins({ subsets: ['latin'], weight: ['500', '600', '700', '800'] });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

/**
 * Full-screen Wallet shell — same convention as `(ride)/ride/layout.tsx`:
 * no Sidebar/DashboardHeader/BottomNavigation, since every screen in the
 * locked Figma Make source (`walletScreen.tsx`) uses its own full-bleed
 * `position: absolute; inset: 0` layout with its own status bar.
 */
export default function WalletLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <div
      className={`relative mx-auto min-h-dvh max-w-[480px] ${inter.className}`}
      style={{ background: NAVY_DEEP }}
    >
      <SuperAppFontProvider heading={poppins.className} body={inter.className}>
        <DashboardAuthGate>{children}</DashboardAuthGate>
      </SuperAppFontProvider>
    </div>
  );
}
