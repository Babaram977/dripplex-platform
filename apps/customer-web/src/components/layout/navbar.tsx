'use client';

import { ThemeToggle } from '@dripplex/hooks';
import { DripplexLogo, Button } from '@dripplex/ui';
import { cn } from '@dripplex/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { siteConfig } from '@/lib/site';

const publicLinks = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
] as const;

export function Navbar(): React.JSX.Element {
  const pathname = usePathname();

  return (
    <header className="border-border/70 bg-background/80 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <DripplexLogo />
          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {publicLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'hover:bg-muted rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    active ? 'text-foreground' : 'text-muted-foreground',
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link href={siteConfig.links.login}>Login</Link>
          </Button>
          <Button asChild>
            <Link href={siteConfig.links.register}>Create Account</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
