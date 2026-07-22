import { ThemeToggle } from '@dripplex/hooks';
import { DripplexLogo, DripplexTagline } from '@dripplex/ui';
import Link from 'next/link';
import * as React from 'react';

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_0.95fr]">
      <aside className="text-primary-foreground bg-brand-gradient relative hidden overflow-hidden p-10 lg:flex lg:flex-col lg:justify-between">
        <DripplexLogo invertWordmark className="text-primary-foreground" />
        <div className="max-w-md space-y-4">
          <DripplexTagline className="text-4xl font-semibold" />
          <p className="text-primary-foreground/85 text-base">
            Sign in to your Dripplex account to access marketplace, delivery, rides, and wallet from
            one calm home.
          </p>
        </div>
        <p className="text-primary-foreground/70 text-sm">Built for Nigeria. Ready for Africa.</p>
      </aside>
      <div className="flex flex-col">
        <div className="border-border/70 flex items-center justify-between border-b px-4 py-4 lg:px-8">
          <div className="lg:hidden">
            <DripplexLogo />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground text-sm font-medium"
            >
              Back to site
            </Link>
          </div>
        </div>
        <main
          id="main-content"
          className="flex flex-1 items-center justify-center px-4 py-10 lg:px-8"
        >
          <div className="animate-fade-up w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}
