'use client';

import { NAVY_DEEP, SuperAppFontProvider } from '@dripplex/ui';
import { Inter, Poppins } from 'next/font/google';
import * as React from 'react';

const poppins = Poppins({ subsets: ['latin'], weight: ['500', '600', '700', '800'] });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

/**
 * Full-bleed SuperApp shell for the Marketplace module — deliberately has
 * no site Navbar/Footer. DrippleX is a mobile-first Super App: the
 * marketing site (`/`) and the authenticated app experience are two
 * separate shells, and once a screen belongs to the app (Marketplace,
 * Ride, Wallet, Orders, AI, Profile, ...) it uses the Figma-locked
 * navigation (its own back button, bottom tab bar, floating AI button)
 * instead of the website chrome. Mirrors the same architecture already
 * established for Ride (see `(ride)/ride/layout.tsx`), kept as a separate
 * layout rather than a shared one so this module's rollout can't regress
 * Ride's already-locked shell.
 *
 * No auth gate here: Marketplace browsing (product/store pages) is public
 * — only cart/favourite actions require sign-in, enforced per-action by
 * the pages themselves.
 */
export default function MarketplaceLayout({
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
