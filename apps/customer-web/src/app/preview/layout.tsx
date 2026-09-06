import type { Metadata } from 'next';
import type * as React from 'react';

/**
 * `/preview/*` holds work-in-progress versions of shipped pages — home-v2,
 * marketplace-v2, store-v2. They are publicly reachable, and they are near
 * duplicates of the real home, marketplace and store pages, which is exactly
 * what produces "Duplicate without user-selected canonical".
 *
 * None of them appear in the indexed export of 2026-09-06, so they may simply
 * not have been found yet. `noindex` rather than a robots.txt `Disallow`
 * covers both cases: if Google has not seen them it never indexes them, and
 * if it has, it can still crawl the page and read the exclusion. A disallow
 * would trap any that were already indexed.
 *
 * Whether these should be reachable in production at all is a separate
 * product question, logged rather than decided here.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <>{children}</>;
}
