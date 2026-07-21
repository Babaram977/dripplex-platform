'use client';

import { Home, Package, ShoppingBag, UserRound, Wallet } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { cn } from '@/lib/utils';

const items = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/dashboard#marketplace', label: 'Shop', icon: ShoppingBag },
  { href: '/dashboard#orders', label: 'Orders', icon: Package },
  { href: '/dashboard#wallet', label: 'Wallet', icon: Wallet },
  { href: '/dashboard#profile', label: 'Profile', icon: UserRound },
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
          const active = pathname === '/dashboard' && item.href.startsWith('/dashboard');
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-md px-2 py-2 text-[11px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
                aria-current={
                  item.href === '/dashboard' && pathname === '/dashboard' ? 'page' : undefined
                }
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
