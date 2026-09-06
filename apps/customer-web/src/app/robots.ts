import type { MetadataRoute } from 'next';

import { siteConfig } from '@/lib/site';

/**
 * Crawl rules.
 *
 * Three mechanisms, and picking the wrong one makes an indexing problem
 * permanent rather than fixing it:
 *
 * - `Disallow` stops Google FETCHING a URL. It does not remove a URL already
 *   indexed — and a page Google may not fetch is a page whose `noindex` it can
 *   never read, so disallowing an indexed URL freezes it in the index.
 * - `robots: { index: false }` in a route's metadata removes it, but only
 *   while the page stays crawlable.
 * - A redirect resolves itself. Google follows it, sees the destination, and
 *   drops the source — but ONLY if it is allowed to fetch the source.
 *
 * That last point is why this list is much shorter than it first was. Every
 * path here was checked against the running app rather than assumed, and
 * `/dashboard`, `/account`, `/driver-onboarding`, `/wallet`, `/ride`,
 * `/marketplace/cart`, `/marketplace/checkout` and `/marketplace/tracking` all
 * turned out to be 307s to `/get-the-app` (next.config.ts — marketing lives
 * here, doing things happens in the app). Blocking them would have prevented
 * Google resolving those redirects, which is precisely how the already-indexed
 * `/marketplace/cart` gets dropped. So none of them appear below.
 *
 * What remains is the set that genuinely renders `200`, has no search value,
 * and was never indexed — so blocking the fetch costs nothing and saves crawl
 * budget. Pages that DID get indexed and should not have been (`/login`, and
 * the `/preview/*` drafts) carry `noindex` in their own layouts instead, and
 * are deliberately absent here so Google can still read that tag.
 *
 * Checked against the Search Console "Valid" export of 2026-09-06.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        // Single-use credential and verification flows, plus the OAuth
        // callback. All render 200, none is meaningful in search.
        '/forgot-password',
        '/reset-password',
        '/verify-email',
        '/verify-otp',
        '/auth/',
      ],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
