import * as React from 'react';

import type { Metadata } from 'next';

import { siteConfig } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About',
  description: 'Learn why DrippleX exists and how it simplifies everyday life across Nigeria.',
};

export default function AboutPage(): React.JSX.Element {
  return (
    <div className="container max-w-3xl py-16">
      <h1 className="font-display text-4xl font-semibold tracking-tight">About DrippleX</h1>
      <p className="text-muted-foreground mt-4 text-lg">{siteConfig.tagline}</p>
      <div className="text-foreground/90 mt-8 space-y-4 text-base leading-relaxed">
        <p>
          DrippleX is a Nigerian Super Platform designed to unify marketplace commerce, food and
          parcel delivery, ride hailing, pharmacy, home services, and wallet payments into one
          trustworthy experience.
        </p>
        <p>
          We are building for millions of people first in Nigeria, with architecture ready for
          expansion across Africa. This customer web foundation is the shell future product modules
          will plug into.
        </p>
      </div>
    </div>
  );
}
