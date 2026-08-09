'use client';

import { cn } from '@dripplex/utils';
import { Car, Home, ShoppingBag, UserRound, Wallet } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

// Mirrors the desktop Sidebar's primary nav — real live routes, not the
// former dead `/dashboard#…` hash anchors. See sidebar.tsx for the Orders
// gap rationale (no Figma Orders-list screen yet).
const items = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/marketplace', label: 'Shop', icon: ShoppingBag },
  { href: '/ride', label: 'Ride', icon: Car },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
  { href: '/account', label: 'Profile', icon: UserRound },
] as const;

export function BottomNavigation(): React.JSX.Element {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile dashboard"
      className="border-border/70 bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-md lg:hidden"
    >
      <ul className="grid grid-cols-5 gap-1 px-2 py-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
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
