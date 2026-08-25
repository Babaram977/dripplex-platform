/**
 * Shared Next.js security headers for DrippleX portals (Program C3).
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
 * @param {{ enableHsts?: boolean, isProduction?: boolean }} [options]
 */
export function dripplexNextHeaders(options = {}) {
  return async () => [
    {
      source: '/:path*',
      headers: dripplexSecurityHeaders(options),
    },
  ];
}
