'use client';

import { useAuth } from '@dripplex/hooks';
import { DripplexLogo } from '@dripplex/ui';
import { cn } from '@dripplex/utils';
import {
  Car,
  Home,
  LayoutDashboard,
  LayoutGrid,
  ShoppingBag,
  UserRound,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { siteConfig } from '@/lib/site';
import { useUiStore } from '@/stores/ui-store';

// Primary Super App nav. Each entry points at a real, already-live route
// group in this app (verified against `docs/reference/dpx-100-figma-screen-mapping.md`:
// Marketplace/Ride/Wallet/Account are ✅ Live). These replaced dead
// `/dashboard#…` hash anchors that resolved to nothing on the dashboard
// page. The Figma "Orders list" screen does not exist yet (only per-order
// tracking at `/marketplace/tracking/[orderId]`), so there is no Orders
// entry — logged in `docs/reference/DPX-FIGMA-DIFF-REGISTER.md` for founder design.
const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/marketplace', label: 'Marketplace', icon: ShoppingBag },
  { href: '/ride', label: 'Ride', icon: Car },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
  { href: '/account', label: 'Profile', icon: UserRound },
] as const;

/**
 * Role-toggle drawer (Super App shell, DPX-100 Phase 1). Each entry is
 * gated on the real role names the backend seeds
 * (`apps/backend/prisma/seed-rbac.cjs`), read from `user.roles` off
 * `/auth/me` -- not decorative, and not one entry per portal regardless
 * of account. A customer-only account sees none of these; an account
 * that also holds the `driver` role sees Driver, etc. Today each link
 * opens the real, already-live portal app in a new tab (cross-app
 * navigation) -- Phase 2 replaces Driver with an embedded in-app section
 * ported from the Figma source; Ops/Admin stay separate desktop consoles
 * because the Figma design itself renders them in a `DesktopFrame`, not
 * a phone frame.
 */
interface CrossPortalLink {
  role: string;
  label: string;
  href: string;
  icon: typeof Car;
}

// Driver and merchant are deliberately absent: dripplex.com is marketing, and
// neither role signs on here any more. Operations stays because the console is
// a desktop tool that is not part of the app.
const CROSS_PORTAL_ROLE_LINKS: readonly CrossPortalLink[] = [
  {
    role: 'operations_staff',
    label: 'Operations',
    href: siteConfig.crossPortalUrls.operations,
    icon: LayoutGrid,
  },
];

export function Sidebar(): React.JSX.Element {
  const pathname = usePathname();
  const collapsed = useUiStore((state) => state.isSidebarCollapsed);
  const { user } = useAuth();
  const roles = React.useMemo(() => new Set(user?.roles ?? []), [user?.roles]);

  const crossPortalItems = React.useMemo((): readonly CrossPortalLink[] => {
    const items = CROSS_PORTAL_ROLE_LINKS.filter((item) => roles.has(item.role));
    // An administrator is sent to the Operations Console, the same place
    // operations staff go. This used to point at a separate Admin Portal on
    // its own domain; that portal is retired, and leaving the link would hand
    // an administrator a dead host. Skipped when the operations_staff entry
    // already added it, so an admin who is also ops staff sees one link.
    const isAdmin = roles.has('administrator') || roles.has('super_administrator');
    const alreadyHasOps = items.some((item) => item.href === siteConfig.crossPortalUrls.operations);
    return isAdmin && !alreadyHasOps
      ? [
          ...items,
          {
            role: 'administrator',
            label: 'Operations',
            href: siteConfig.crossPortalUrls.operations,
            icon: LayoutGrid,
          },
        ]
      : items;
  }, [roles]);

  return (
    <aside
      className={cn(
        'border-border/70 bg-card/80 sticky top-0 hidden h-dvh shrink-0 border-r backdrop-blur-md transition-[width] duration-200 lg:flex lg:flex-col',
        collapsed ? 'w-[4.5rem]' : 'w-64',
      )}
      aria-label="Dashboard sidebar"
    >
      <div
        className={cn(
          'border-border/70 flex h-16 items-center border-b px-4',
          collapsed && 'justify-center',
        )}
      >
        <DripplexLogo showWordmark={!collapsed} href="/dashboard" />
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Dashboard">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'hover:bg-muted inline-flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                active ? 'bg-brand-muted text-foreground' : 'text-muted-foreground',
                collapsed && 'justify-center px-2',
              )}
              aria-current={active ? 'page' : undefined}
              title={item.label}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {!collapsed ? (
                <span>{item.label}</span>
              ) : (
                <span className="sr-only">{item.label}</span>
              )}
            </Link>
          );
        })}

        {/*
          "Become a Driver" used to sit here and open driver onboarding on this
          domain. Drivers are recruited and onboarded in the app now, so the
          website no longer offers a second way in.
        */}

        {crossPortalItems.length > 0 ? (
          <div className="border-border/70 mt-3 border-t pt-3">
            {!collapsed ? (
              <p className="text-muted-foreground px-3 pb-1 text-xs font-medium uppercase tracking-wide">
                Your other apps
              </p>
            ) : null}
            {crossPortalItems.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.role}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'hover:bg-muted text-muted-foreground inline-flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                    collapsed && 'justify-center px-2',
                  )}
                  title={`${item.label} (opens in a new tab)`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {!collapsed ? (
                    <span>{item.label}</span>
                  ) : (
                    <span className="sr-only">{item.label}</span>
                  )}
                </a>
              );
            })}
          </div>
        ) : null}

        <Link
          href="/"
          className={cn(
            'text-muted-foreground hover:bg-muted mt-auto inline-flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
            collapsed && 'justify-center px-2',
          )}
        >
          <Home className="h-4 w-4 shrink-0" aria-hidden="true" />
          {!collapsed ? <span>Back to site</span> : <span className="sr-only">Back to site</span>}
        </Link>
      </nav>
    </aside>
  );
}
