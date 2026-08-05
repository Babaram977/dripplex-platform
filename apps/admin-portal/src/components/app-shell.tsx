'use client';

import { useAuth } from '@dripplex/hooks';
import { Button } from '@dripplex/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

import { PortalAuthGate } from '@/components/portal-auth-gate';
import { sdk } from '@/lib/sdk';

/** Grows one slice at a time, same discipline as operations-console's
 * AppShell — only routes that actually exist get a nav entry. Home
 * (backend status) and Commercial (DPX-COMMERCIAL-001 Slice 5) are the
 * only two real screens in this app today. */
const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/commercial', label: 'Commercial' },
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
          <span className="font-display text-lg font-semibold tracking-tight">DrippleX Admin</span>
          <nav className="flex gap-1">
            {NAV_LINKS.map((link) => {
              const isActive =
                link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-secondary text-secondary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground hidden text-sm md:inline">
            {user ? `${user.firstName} ${user.lastName}` : ''}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={() => void onLogout()}>
            Sign out
          </Button>
        </div>
      </div>
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
