'use client';

import { DripplexLogo } from '@dripplex/ui';
import { cn } from '@dripplex/utils';
import {
  Building2,
  ClipboardList,
  Home,
  LayoutDashboard,
  Package,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { useUiStore } from '@/stores/ui-store';

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/orders', label: 'Orders', icon: ClipboardList },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/business', label: 'Business', icon: Building2 },
  { href: '/kyc', label: 'Verification', icon: ShieldCheck },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar(): React.JSX.Element {
  const pathname = usePathname();
  const collapsed = useUiStore((state) => state.isSidebarCollapsed);

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
        <DripplexLogo showWordmark={!collapsed} href="/" />
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Dashboard">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
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
        <a
          href="https://dripplex.com"
          className={cn(
            'text-muted-foreground hover:bg-muted mt-auto inline-flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
            collapsed && 'justify-center px-2',
          )}
        >
          <Home className="h-4 w-4 shrink-0" aria-hidden="true" />
          {!collapsed ? <span>Back to site</span> : <span className="sr-only">Back to site</span>}
        </a>
      </nav>
    </aside>
  );
}
