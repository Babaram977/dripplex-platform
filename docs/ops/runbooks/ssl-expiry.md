# Runbook — SSL Expiry

**Alert:** `SslExpiry`

## Actions

1. Confirm which cert: Cloudflare edge vs Origin CA.
2. Edge: Cloudflare Universal/ACM auto-renew — check dashboard.
3. Origin: reissue Cloudflare Origin CA; install on nginx; reload.
4. Verify `openssl s_client` and blackbox SSL metrics.
5. Never disable Full (strict) to “fix” expiry.
