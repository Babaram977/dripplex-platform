import { DripplexLogo } from '@dripplex/ui';
import Link from 'next/link';
import * as React from 'react';

import { siteConfig } from '@/lib/site';

export function Footer(): React.JSX.Element {
  const year = new Date().getFullYear();

  return (
    <footer className="border-border/70 bg-background/70 border-t">
      <div className="container flex flex-col gap-8 py-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm space-y-3">
          <DripplexLogo />
          <p className="font-display text-muted-foreground text-lg">{siteConfig.tagline}</p>
          <p className="text-muted-foreground text-sm">
            Nigeria’s Super Platform for everyday movement, commerce, and care.
          </p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          <div className="space-y-3">
            <p className="text-sm font-semibold">Company</p>
            <ul className="text-muted-foreground space-y-2 text-sm">
              <li>
                <Link href="/about" className="hover:text-foreground">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-foreground">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold">Legal</p>
            <ul className="text-muted-foreground space-y-2 text-sm">
              <li>
                <Link href="/privacy" className="hover:text-foreground">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-foreground">
                  Terms
                </Link>
              </li>
            </ul>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold">Account</p>
            <ul className="text-muted-foreground space-y-2 text-sm">
              <li>
                <Link href="/login" className="hover:text-foreground">
                  Login
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-foreground">
                  Create Account
                </Link>
              </li>
            </ul>
          </div>
        </nav>
      </div>
      <div className="border-border/70 border-t">
        <div className="text-muted-foreground container flex flex-col gap-2 py-4 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {siteConfig.name}. All rights reserved.
          </p>
          <p>{siteConfig.tagline}</p>
        </div>
      </div>
    </footer>
  );
}
