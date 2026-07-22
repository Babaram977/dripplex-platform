'use client';

import { cn } from '@dripplex/utils';
import { Home, Package, UserRound, Wallet } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

const items = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/dashboard/orders', label: 'Orders', icon: Package },
  { href: '/dashboard/wallet', label: 'Wallet', icon: Wallet },
  { href: '/dashboard/profile', label: 'Profile', icon: UserRound },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') {
    return pathname === '/dashboard';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNavigation(): React.JSX.Element {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile dashboard"
      className="border-border/70 bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-md lg:hidden"
    >
      <ul className="grid grid-cols-4 gap-1 px-2 py-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-md px-2 py-2 text-[11px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
