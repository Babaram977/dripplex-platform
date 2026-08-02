import * as React from 'react';

import { DashboardAuthGate } from '@/components/auth/dashboard-auth-gate';

/**
 * Full-screen Ride shell — deliberately has no Sidebar/DashboardHeader/
 * BottomNavigation. Every screen in the real Figma Make source uses
 * `position: absolute; inset: 0` full-bleed layout with its own status bar,
 * which only makes sense outside the (dashboard) shell (see
 * docs/RIDE-003-READINESS.md's "Customer Web routing" section, now resolved
 * by that real visual evidence).
 */
export default function RideLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <div className="relative mx-auto min-h-dvh max-w-[480px]" style={{ background: '#060E1C' }}>
      <DashboardAuthGate>{children}</DashboardAuthGate>
    </div>
  );
}
