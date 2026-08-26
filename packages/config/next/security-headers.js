/**
 * Shared Next.js security headers for Dripplex portals (Program C3).
 * Keep CSP strict enough for XSS mitigation while allowing next/font and inline theme bootstraps.
 */

/** @typedef {{ key: string, value: string }} HeaderTuple */

/**
 * @param {{ enableHsts?: boolean, isProduction?: boolean }} [options]
 * @returns {HeaderTuple[]}
 */
export function dripplexSecurityHeaders(options = {}) {
  const isProduction = options.isProduction ?? process.env.NODE_ENV === 'production';
  const enableHsts = options.enableHsts ?? isProduction;

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    // next/font inlines + theme bootstrap script on customer-web
    "style-src 'self' 'unsafe-inline'",
    // Next.js dev mode (Fast Refresh/Turbopack HMR) requires 'unsafe-eval'; production builds don't.
    `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"}`,
    // Backend Core + payment redirects (http localhost for local API)
    "connect-src 'self' http://localhost:* https://localhost:* https:",
  ];

  if (isProduction) {
    csp.push('upgrade-insecure-requests');
  }

  /** @type {HeaderTuple[]} */
  const headers = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      // camera=(self): Driver-001 facial verification (driver-portal) needs
      // getUserMedia for selfie capture. Still blocked for cross-origin embeds.
      key: 'Permissions-Policy',
      value: 'camera=(self), microphone=(), geolocation=(self), payment=()',
    },
    {
      key: 'Content-Security-Policy',
      value: csp.join('; '),
    },
  ];

  if (enableHsts) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload',
    });
  }

  return headers;
}

/**
 * Everything that is not an immutable build asset.
 *
 * `/_next/static/*` and `/_next/image` are excluded because their URLs already
 * carry a content hash: they are genuinely immutable and *should* be cached
 * forever. Everything else — the HTML documents above all — must not be.
 */
const DOCUMENT_ROUTES = '/((?!_next/static|_next/image).*)';

/**
 * Stop a CDN serving a year-old copy of a deployed page.
 *
 * Next emits `Cache-Control: s-maxage=31536000` on statically prerendered
 * routes. On Vercel that is safe because the CDN is purged on every deploy.
 * These portals sit behind Cloudflare, which honours the year and is never
 * purged — so on 2026-08-26 a deploy that had genuinely succeeded served the
 * previous build's HTML at admin.dripplex.com, and because that stale HTML
 * names the previous build's hashed chunks, the whole page stayed old. The
 * origin was correct the entire time; only the edge was wrong.
 *
 * `no-cache` is not "do not store": the response is still cached, and the
 * ETag Next already sends turns the revalidation into a 304 for an unchanged
 * page. What it buys is that a deploy is visible immediately, which for an
 * operations console holding money controls is worth one conditional request.
 *
 * @param {{ enableHsts?: boolean, isProduction?: boolean }} [options]
 */
export function dripplexNextHeaders(options = {}) {
  return async () => [
    {
      source: '/:path*',
      headers: dripplexSecurityHeaders(options),
    },
    {
      source: DOCUMENT_ROUTES,
      headers: [{ key: 'Cache-Control', value: 'no-cache' }],
    },
  ];
}
