import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import { dripplexNextHeaders } from '@dripplex/config/next/security-headers';

import type { NextConfig } from 'next';

/**
 * `output: 'standalone'` is required for the Docker image (apps/customer-web/Dockerfile).
 * OpenNext / Cloudflare Workers Builds must NOT use standalone — set DOCKER_BUILD=1 only in Docker.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(process.env['DOCKER_BUILD'] === '1' ? { output: 'standalone' as const } : {}),
  transpilePackages: [
    '@dripplex/ui',
    '@dripplex/hooks',
    '@dripplex/types',
    '@dripplex/utils',
    '@dripplex/sdk',
  ],
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', '@dripplex/ui'],
  },
  headers: dripplexNextHeaders(),
  /**
   * Send the bare apex to www, permanently.
   *
   * Both hostnames are attached to this same Railway service and both answered
   * 200 with identical content and no canonical tag, which is a duplicate-origin
   * split: search engines index two copies, and a session cookie set on one is
   * not sent to the other. One host has to win. Founder chose www.
   *
   * 308, not 307 or 302: permanent so the duplicate actually collapses in search
   * indexes, and 308 rather than 301 because it is the method-preserving form —
   * a 301 lets intermediaries rewrite POST to GET, which would silently turn a
   * form submission against the apex into a dropped request.
   *
   * `has` matches the Host header, so this only fires for the apex. www itself
   * never matches and cannot loop. `:path*` carries the whole path and Next
   * preserves the query string.
   *
   * DEPLOYING THIS BEFORE www HAS A CERTIFICATE BREAKS THE SITE. www currently
   * serves Railway's *.up.railway.app wildcard, and the app sends HSTS with
   * includeSubDomains and preload — so a browser sent from the apex to www hits
   * a hard TLS failure with no click-through. That includes
   * dripplex.com/account-deletion, the URL Google Play requires.
   */
  redirects: async () => [
    {
      source: '/:path*',
      has: [{ type: 'host', value: 'dripplex.com' }],
      destination: 'https://www.dripplex.com/:path*',
      permanent: true,
    },

    /**
     * dripplex.com is marketing. Doing things happens in the app.
     *
     * These paths are the product that used to run on this domain: a customer
     * dashboard, wallet, ride booking, cart and checkout, and a full driver
     * onboarding flow with document upload. All of it also exists in the Super
     * App, so keeping it here meant two front doors to the same account —
     * and a driver could start onboarding in the wrong one.
     *
     * Redirected rather than deleted. The screens still work, so if any of
     * this should come back to the web it is a config change, not a rebuild.
     *
     * 307, not 308: temporary, because this is a product decision that may be
     * revisited, and a permanent redirect would be cached in browsers long
     * after the decision changed. `/marketplace` browsing is NOT here — public
     * merchant and product pages need no sign-in and earn their place as
     * marketing.
     */
    ...['/dashboard', '/account', '/driver-onboarding', '/wallet', '/ride'].flatMap((base) => [
      { source: base, destination: '/get-the-app', permanent: false },
      { source: `${base}/:path*`, destination: '/get-the-app', permanent: false },
    ]),

    // Shopping carries a signed-in cart and payment; browsing does not.
    ...['/marketplace/cart', '/marketplace/checkout', '/marketplace/tracking'].flatMap((base) => [
      { source: base, destination: '/get-the-app', permanent: false },
      { source: `${base}/:path*`, destination: '/get-the-app', permanent: false },
    ]),
  ],
};

export default nextConfig;

// Enable Cloudflare bindings during `next dev`.
initOpenNextCloudflareForDev();
