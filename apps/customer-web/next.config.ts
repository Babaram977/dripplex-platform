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
  ],
};

export default nextConfig;

// Enable Cloudflare bindings during `next dev`.
initOpenNextCloudflareForDev();
