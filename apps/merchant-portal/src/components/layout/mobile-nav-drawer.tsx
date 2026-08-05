'use client';

import { Drawer, DrawerContent, DrawerTitle, DripplexLogo } from '@dripplex/ui';
import { cn } from '@dripplex/utils';
import {
  Building2,
  ClipboardList,
  Home,
  LayoutDashboard,
  Package,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { useUiStore } from '@/stores/ui-store';

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/orders', label: 'Orders', icon: ClipboardList },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/wallet', label: 'Wallet & Bank', icon: Wallet },
  { href: '/business', label: 'Business', icon: Building2 },
  { href: '/kyc', label: 'Verification', icon: ShieldCheck },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === '/';
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
        <DripplexLogo href="/" />
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
          <a
            href="https://dripplex.com"
            className="text-muted-foreground hover:bg-muted mt-4 inline-flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            Back to site
          </a>
        </nav>
      </DrawerContent>
    </Drawer>
  );
}
