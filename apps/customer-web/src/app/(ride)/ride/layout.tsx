import * as React from 'react';

import { DashboardAuthGate } from '@/components/auth/dashboard-auth-gate';

/**
 * Full-screen Ride shell — deliberately has no Sidebar/DashboardHeader/
 * BottomNavigation. Every screen in the real Figma Make source uses
 * `position: absolute; inset: 0` full-bleed layout with its own status bar,
 * which only makes sense outside the (dashboard) shell (see
 * docs/RIDE-003-READINESS.md's "Customer Web routing" section, now resolved
 * by that real visual evidence).
 *
 * Loads Poppins/Inter here, scoped to Ride only — the rest of the app uses
 * Sora/Manrope (see the root layout). Every Ride component references
 * these two literal family names in inline styles, copied verbatim from
 * the real Figma Make source; without an actual font load they silently
 * fall back to the browser default sans-serif, which is a real visual
 * defect (wrong letterforms/weights/spacing vs. the locked design), caught
 * and fixed here rather than left in place.
 */
export default function RideLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <div className="relative mx-auto min-h-dvh max-w-[480px]" style={{ background: '#060E1C' }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router hoists <link> from any layout/page into <head>; this rule predates App Router and assumes Pages Router's _document.js, which doesn't exist here. Scoping the load to this layout (not the root) is intentional: Ride is the only route using Poppins/Inter. */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap"
      />
      <DashboardAuthGate>{children}</DashboardAuthGate>
    </div>
  );
}
