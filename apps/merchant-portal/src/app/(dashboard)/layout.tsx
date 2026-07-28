import * as React from 'react';

import { DashboardHeader } from '@/components/layout/dashboard-header';
import { MobileNavDrawer } from '@/components/layout/mobile-nav-drawer';
import { Sidebar } from '@/components/layout/sidebar';
import { PortalAuthGate } from '@/components/portal-auth-gate';

export default function DashboardShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <div className="bg-background flex min-h-dvh">
      <Sidebar />
      <MobileNavDrawer />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader />
        <main id="main-content" className="flex-1 px-4 py-6 md:px-6">
          <PortalAuthGate>{children}</PortalAuthGate>
        </main>
      </div>
    </div>
  );
}
