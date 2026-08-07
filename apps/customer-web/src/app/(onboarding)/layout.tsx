'use client';

import { NAVY_DEEP, SuperAppFontProvider } from '@dripplex/ui';
import { Inter, Poppins } from 'next/font/google';
import * as React from 'react';

const poppins = Poppins({ subsets: ['latin'], weight: ['500', '600', '700', '800'] });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

/**
 * Full-screen onboarding shell for the pre-auth Welcome/Register/Sign-In
 * flow -- deliberately unauthenticated (no `DashboardAuthGate`, unlike
 * `/ride` and `/wallet`'s layouts) since a visitor hasn't signed in yet.
 * Same `max-w-[480px]` full-bleed mobile-app shell as every other DPX-100
 * module, matching the Figma Make source's own layout intent. Shared by
 * `/get-started` and `/login` (DPX-100 Auth Slice 5, see
 * docs/AUTH-DPX-100-REALITY-AUDIT.md) -- was previously scoped only to
 * `/get-started`.
 */
export default function OnboardingLayout({
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
        {children}
      </SuperAppFontProvider>
    </div>
  );
}
