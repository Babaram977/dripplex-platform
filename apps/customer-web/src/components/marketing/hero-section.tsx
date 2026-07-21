import { Button } from '@dripplex/ui';
import Link from 'next/link';
import * as React from 'react';

import { siteConfig } from '@/lib/site';

export function HeroSection(): React.JSX.Element {
  return (
    <section className="relative isolate min-h-[100dvh] overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,hsl(var(--brand)/0.18),transparent_35%),radial-gradient(circle_at_80%_10%,hsl(var(--accent)/0.2),transparent_30%),linear-gradient(180deg,transparent,hsl(var(--background)))]"
      />
      <div
        aria-hidden="true"
        className="bg-[url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 800 900%27%3E%3Cdefs%3E%3ClinearGradient id=%27g%27 x1=%270%27 y1=%270%27 x2=%271%27 y2=%271%27%3E%3Cstop stop-color=%27%230A5C52%27/%3E%3Cstop offset=%271%27 stop-color=%27%23E85D04%27 stop-opacity=%270.75%27/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width=%27800%27 height=%27900%27 fill=%27url(%23g)%27/%3E%3Ccircle cx=%27580%27 cy=%22220%27 r=%22160%27 fill=%27%23fff%27 fill-opacity=%270.08%27/%3E%3Ccircle cx=%22220%27 cy=%22680%27 r=%22200%27 fill=%27%23000%27 fill-opacity=%270.12%27/%3E%3Cpath d=%27M0 620 C180 540 320 740 520 660 C680 600 760 700 800 640 L800 900 L0 900 Z%27 fill=%27%23fff%27 fill-opacity=%270.1%27/%3E%3C/svg%3E')] absolute inset-y-0 right-0 -z-10 hidden w-[52%] bg-cover bg-center lg:block"
      />
      <div className="container flex min-h-[100dvh] flex-col justify-center py-24 lg:max-w-3xl lg:py-28">
        <p className="animate-fade-up font-display text-foreground text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl">
          {siteConfig.name}
        </p>
        <p
          className="animate-fade-up font-display text-accent mt-3 text-2xl sm:text-3xl"
          style={{ animationDelay: '80ms' }}
        >
          {siteConfig.tagline}
        </p>
        <h1
          className="animate-fade-up text-foreground mt-8 max-w-xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
          style={{ animationDelay: '140ms' }}
        >
          One Super Platform for the way Nigeria moves, shops, and pays.
        </h1>
        <p
          className="animate-fade-up text-muted-foreground mt-4 max-w-lg text-base sm:text-lg"
          style={{ animationDelay: '200ms' }}
        >
          Marketplace, food, parcels, rides, pharmacy, home services, and wallet — connected in a
          single calm experience.
        </p>
        <div
          className="animate-fade-up mt-8 flex flex-col gap-3 sm:flex-row"
          style={{ animationDelay: '260ms' }}
        >
          <Button asChild size="lg">
            <Link href={siteConfig.links.register}>Create Account</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={siteConfig.links.login}>Login</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
