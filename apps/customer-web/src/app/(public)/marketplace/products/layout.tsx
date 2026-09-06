import type { Metadata } from 'next';
import type * as React from 'react';

/**
 * Collapse the category-filtered variants of this listing onto one canonical.
 *
 * `/marketplace/products?categoryId=…` renders the same page with a filter
 * applied. Google indexed five of those query-string URLs as separate pages
 * (Search Console export, 2026-09-06) because nothing told it otherwise, and
 * reported them as "Duplicate without user-selected canonical".
 *
 * An absolute path is used rather than the root layout's `'./'` on purpose:
 * the point here is to drop the query string, so the canonical must not be
 * derived from the URL that was requested.
 *
 * The pages stay crawlable and indexable — a canonical is a consolidation
 * hint, not an exclusion. Category filters are a legitimate way in; they just
 * should not compete with the unfiltered listing for the same content.
 */
export const metadata: Metadata = {
  alternates: {
    canonical: '/marketplace/products',
  },
};

export default function ProductsListingLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <>{children}</>;
}
