'use client';

import { ThemeToggle, useAuth } from '@dripplex/hooks';
import { DripplexLogo, Button } from '@dripplex/ui';
import { cn } from '@dripplex/utils';
import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

import { describeSdkError, sdk } from '@/lib/sdk';
import { siteConfig } from '@/lib/site';

const publicLinks = [
  { href: '/', label: 'Home' },
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
] as const;

export function Navbar(): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { hydrated, isAuthenticated, clearSession, user } = useAuth();
  const [signingOut, setSigningOut] = React.useState(false);

  const onLogout = async (): Promise<void> => {
    setSigningOut(true);
    try {
      await sdk.auth.logout();
    } catch (error) {
      // Clear local session even if the network call fails (expired session, offline).
      void describeSdkError(error);
    } finally {
      clearSession();
      setSigningOut(false);
      router.push(siteConfig.links.login);
    }
  };

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
          <Button asChild variant="ghost" className="inline-flex items-center gap-2">
            <Link href="/marketplace/cart" aria-label="View cart">
              <ShoppingCart className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Cart</span>
            </Link>
          </Button>
          <ThemeToggle />
          {!hydrated ? null : isAuthenticated ? (
            <>
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link href={siteConfig.links.getTheApp}>{user ? user.firstName : 'Open app'}</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={signingOut}
                onClick={() => {
                  void onLogout();
                }}
              >
                {signingOut ? 'Signing out…' : 'Sign out'}
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link href={siteConfig.links.login}>Login</Link>
              </Button>
              <Button asChild>
                <Link href={siteConfig.links.register}>Create Account</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
