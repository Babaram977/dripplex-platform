'use client';

import { useAuth } from '@dripplex/hooks';
import { Button } from '@dripplex/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

import { PortalAuthGate } from '@/components/portal-auth-gate';
import { sdk } from '@/lib/sdk';

interface NavLinkItem {
  href: string;
  label: string;
}

interface NavGroupItem {
  label: string;
  items: NavLinkItem[];
}

type NavEntry = NavLinkItem | NavGroupItem;

/** DPX-OPS-001 — the console's surfaces grouped into a few header menus so the
 * bar stays legible as the number of screens grows (approvals, inspections and
 * work-queues each collapse into one dropdown). Every route below exists; no
 * placeholder/disabled links. */
const NAV: NavEntry[] = [
  { href: '/', label: 'Live Fleet Map' },
  {
    label: 'Approvals',
    items: [
      { href: '/drivers', label: 'Driver Approvals' },
      { href: '/riders', label: 'Rider Approvals' },
      { href: '/merchants', label: 'Merchant Approvals' },
      { href: '/vehicles', label: 'Vehicle Approvals' },
    ],
  },
  {
    label: 'Inspections',
    items: [
      { href: '/inspections', label: 'Inspections' },
      { href: '/inspection-centres', label: 'Inspection Centres' },
    ],
  },
  {
    label: 'Queues',
    items: [
      { href: '/rides', label: 'Ride Queue' },
      { href: '/queues/sos', label: 'SOS Queue' },
      { href: '/queues/incidents', label: 'Incidents' },
      { href: '/queues/support', label: 'Driver Support' },
    ],
  },
  { href: '/pricing', label: 'Ride Pricing' },
  { href: '/utilities', label: 'Bill Payments' },
  { href: '/analytics', label: 'Analytics' },
];

function isEntryGroup(entry: NavEntry): entry is NavGroupItem {
  return 'items' in entry;
}

function isLinkActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

const linkClass = (active: boolean): string =>
  `block rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    active
      ? 'bg-secondary text-secondary-foreground'
      : 'text-muted-foreground hover:text-foreground'
  }`;

function NavGroup({
  group,
  pathname,
}: {
  group: NavGroupItem;
  pathname: string;
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const groupActive = group.items.some((item) => isLinkActive(pathname, item.href));

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!open) return undefined;
    const handler = (event: MouseEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((prev) => !prev);
        }}
        className={linkClass(groupActive || open)}
      >
        {group.label}
        <span aria-hidden className="ml-1 text-xs">
          ▾
        </span>
      </button>
      {open ? (
        <div className="border-border/70 bg-background absolute left-0 top-full z-20 mt-1 flex min-w-48 flex-col gap-0.5 rounded-md border p-1 shadow-md">
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={linkClass(isLinkActive(pathname, item.href))}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

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
          <span className="font-display text-lg font-semibold tracking-tight">
            DrippleX Operations
          </span>
          <nav className="flex items-center gap-1">
            {NAV.map((entry) =>
              isEntryGroup(entry) ? (
                <NavGroup key={entry.label} group={entry} pathname={pathname} />
              ) : (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className={linkClass(isLinkActive(pathname, entry.href))}
                >
                  {entry.label}
                </Link>
              ),
            )}
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
