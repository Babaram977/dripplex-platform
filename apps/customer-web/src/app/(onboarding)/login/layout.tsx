import type { Metadata } from 'next';
import type * as React from 'react';

/**
 * `/login` was indexed (Search Console export, 2026-09-06). A sign-in form is
 * not a useful search result for anyone, and it competes with the pages that
 * are.
 *
 * `noindex` rather than a robots.txt `Disallow` for the same reason as the
 * cart: the URL is already indexed, and a page Google cannot crawl is a page
 * whose `noindex` Google never reads.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <>{children}</>;
}
