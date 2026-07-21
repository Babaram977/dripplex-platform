import * as React from 'react';

import { BottomNavigation } from '@/components/layout/bottom-navigation';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { Sidebar } from '@/components/layout/sidebar';

export default function DashboardShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <div className="bg-background flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader />
        <main id="main-content" className="flex-1 px-4 pb-24 pt-6 md:px-6 lg:pb-8">
          {children}
        </main>
        <BottomNavigation />
      </div>
    </div>
  );
}
