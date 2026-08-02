'use client';

import { useAuth } from '@dripplex/hooks';
import { Button } from '@dripplex/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

import { NotificationBell } from '@/components/notification-bell';
import { PortalAuthGate } from '@/components/portal-auth-gate';
import { sdk } from '@/lib/sdk';

const NAV_LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/campaign', label: 'Campaign' },
  { href: '/rewards', label: 'Rewards' },
  { href: '/activity', label: 'Activity' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/wallet', label: 'Wallet' },
  { href: '/learn', label: 'Learn' },
] as const;

function AppNav(): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearSession } = useAuth();

  const onLogout = async (): Promise<void> => {
    try {
      await sdk.auth.logout();
    } catch {
      // Local clear still required even if the server call fails.
    } finally {
      clearSession();
      router.push('/login');
    }
  };

  return (
    <header className="border-border/70 bg-background/95 sticky top-0 z-10 border-b backdrop-blur">
      <div className="container flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="flex items-center gap-6">
          <span className="font-display text-lg font-semibold tracking-tight">DrippleX Driver</span>
          <nav className="hidden gap-1 sm:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <span className="text-muted-foreground hidden text-sm md:inline">
            {user ? `${user.firstName} ${user.lastName}` : ''}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={() => void onLogout()}>
            Sign out
          </Button>
        </div>
      </div>
      <nav className="border-border/70 flex gap-1 overflow-x-auto border-t px-4 py-2 sm:hidden">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex-shrink-0 rounded-md px-3 py-1.5 text-sm font-medium ${
              pathname === link.href
                ? 'bg-secondary text-secondary-foreground'
                : 'text-muted-foreground'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <PortalAuthGate>
      <div className="flex min-h-dvh flex-col">
        <AppNav />
        <main className="container flex-1 py-8">{children}</main>
      </div>
    </PortalAuthGate>
  );
}
