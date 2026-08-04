'use client';

import { NAVY_DEEP, SuperAppFontProvider } from '@dripplex/ui';
import { Inter, Poppins } from 'next/font/google';
import * as React from 'react';

import { DashboardAuthGate } from '@/components/auth/dashboard-auth-gate';

const poppins = Poppins({ subsets: ['latin'], weight: ['500', '600', '700', '800'] });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

/**
 * Full-screen Ride shell — deliberately has no Sidebar/DashboardHeader/
 * BottomNavigation. Every screen in the real Figma Make source uses
 * `position: absolute; inset: 0` full-bleed layout with its own status bar,
 * which only makes sense outside the (dashboard) shell (see
 * docs/RIDE-003-READINESS.md's "Customer Web routing" section, now resolved
 * by that real visual evidence).
 *
 * Loads Poppins/Inter via `next/font/google` + `SuperAppFontProvider`,
 * matching the DPX-100 `packages/ui/super-app` font-loading convention
 * (see `(marketplace)/layout.tsx`) — replaces the earlier raw `<link>`-tag
 * CSS load as each Ride screen migrates onto
 * `packages/ui/src/components/super-app/Ride*` components, which read
 * these classNames through `useSuperAppFonts()` instead of hardcoding
 * `fontFamily` inline. Screens not yet migrated still reference the
 * literal family names inline and keep rendering correctly since the same
 * two font families are loaded either way.
 */
export default function RideLayout({
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
