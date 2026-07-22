'use client';

import { Drawer, DrawerContent, DrawerTitle, DripplexLogo } from '@dripplex/ui';
import { cn } from '@dripplex/utils';
import {
  Bell,
  Home,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingBag,
  UserRound,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { useUiStore } from '@/stores/ui-store';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/orders', label: 'Orders', icon: Package },
  { href: '/dashboard/wallet', label: 'Wallet', icon: Wallet },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
  { href: '/dashboard/profile', label: 'Profile', icon: UserRound },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') {
    return pathname === '/dashboard';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNavDrawer(): React.JSX.Element {
  const pathname = usePathname();
  const open = useUiStore((state) => state.isMobileNavOpen);
  const setMobileNavOpen = useUiStore((state) => state.setMobileNavOpen);

  return (
    <Drawer open={open} onOpenChange={setMobileNavOpen}>
      <DrawerContent side="left" className="flex flex-col gap-4 pt-10 lg:hidden">
        <DrawerTitle className="sr-only">Dashboard navigation</DrawerTitle>
        <DripplexLogo href="/dashboard" />
        <nav className="flex flex-col gap-1" aria-label="Mobile dashboard">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  setMobileNavOpen(false);
                }}
                className={cn(
                  'inline-flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-brand-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/"
            onClick={() => {
              setMobileNavOpen(false);
            }}
            className="text-muted-foreground hover:bg-muted mt-4 inline-flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            Back to site
          </Link>
          <p className="text-muted-foreground mt-2 px-3 text-xs">
            Marketplace shopping opens in Program B2.
          </p>
          <span className="text-muted-foreground inline-flex items-center gap-2 px-3 text-xs">
            <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
            Shop — coming soon
          </span>
        </nav>
      </DrawerContent>
    </Drawer>
  );
}
