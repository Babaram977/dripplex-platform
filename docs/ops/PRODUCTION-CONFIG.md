# Production configuration verification (RC1)

Verify before staging cutover. Do **not** commit real secrets.

## Environment variables

| Variable                   | Required        | Notes                                       |
| -------------------------- | --------------- | ------------------------------------------- |
| `NODE_ENV`                 | Yes             | Must be `production`                        |
| `DATABASE_URL`             | Yes             | Postgres TLS URL from secret store          |
| `REDIS_URL`                | Yes             | Redis TLS URL from secret store             |
| `JWT_ACCESS_SECRET`        | Yes             | ≥32 chars; rotate independently of refresh  |
| `JWT_REFRESH_SECRET`       | Yes             | ≥32 chars; never reuse access secret        |
| `CORS_ORIGINS`             | Yes             | Exact HTTPS portal origins only             |
| `API_HOST` / `API_PORT`    | Yes             | Bind behind reverse proxy                   |
| `API_GLOBAL_PREFIX`        | Yes             | `api/v1`                                    |
| `LOG_LEVEL`                | Yes             | Prefer `info` (or `warn` under load)        |
| `THROTTLE_*`               | Yes             | Keep defaults unless load-tested            |
| Payment provider keys      | Staging+        | Paystack / Flutterwave / Moniepoint as used |
| `NEXT_PUBLIC_API_BASE_URL` | Yes (frontends) | `https://api.<domain>/api/v1`               |
| `NEXT_PUBLIC_APP_URL`      | Yes (customer)  | Canonical HTTPS customer origin             |

Full template: root `.env.example`. Backend validation: `apps/backend/src/config/env.validation.ts`.

## Production URLs (fill at deploy)

| Surface  | Expected pattern                                 | Verified |
| -------- | ------------------------------------------------ | -------- |
| API      | `https://api.<domain>`                           | [ ]      |
| Customer | `https://www.<domain>` or `https://app.<domain>` | [ ]      |
| Merchant | `https://merchant.<domain>`                      | [ ]      |
| Rider    | `https://rider.<domain>`                         | [ ]      |
| Admin    | `https://admin.<domain>`                         | [ ]      |
| Ops      | `https://ops.<domain>` (internal)                | [ ]      |

## API endpoints

- Global prefix: `/api/v1`
- Health: `GET /api/v1/health` (DB + Redis)
- Auth / commerce / platform routes frozen under Program A

## HTTPS enforcement

| Check                                               | Status                                          |
| --------------------------------------------------- | ----------------------------------------------- |
| TLS terminated at edge / reverse proxy              | Ops                                             |
| HSTS on portals (`Strict-Transport-Security`, prod) | ✅ via `@dripplex/config/next/security-headers` |
| CSP `upgrade-insecure-requests` in production       | ✅                                              |
| Backend behind HTTPS only (no public HTTP)          | Ops                                             |

## CSP & security headers

Shared module: `packages/config/next/security-headers.js` — wired on all five Next portals.

| Header                    | Present                                              |
| ------------------------- | ---------------------------------------------------- |
| Content-Security-Policy   | ✅ (`'unsafe-inline'` still required for Next/theme) |
| X-Content-Type-Options    | ✅ nosniff                                           |
| X-Frame-Options           | ✅ DENY                                              |
| Referrer-Policy           | ✅                                                   |
| Permissions-Policy        | ✅                                                   |
| Strict-Transport-Security | ✅ production                                        |

## Logging

| Layer    | Mechanism                           | Status                   |
| -------- | ----------------------------------- | ------------------------ |
| Backend  | Nest logger + `LOG_LEVEL`           | ✅                       |
| Frontend | Browser console only (no APM SDK)   | Partial — see monitoring |
| Audit    | `AuditService` on sensitive domains | ✅                       |

## Monitoring & error reporting

| Capability                   | RC1 status                        |
| ---------------------------- | --------------------------------- |
| Health endpoint              | ✅ `/api/v1/health`               |
| Structured APM (Sentry/OTel) | ❌ Deferred — wire in staging ops |
| Crash reporting (web)        | ❌ Deferred                       |
| Analytics product APIs       | ✅ Backend; UI partial            |
| Audit logging                | ✅ Backend                        |

## Feature flags

No dedicated feature-flag service in freeze. Behavioural gates are env-driven (payment provider, throttle, OTP limits). Treat new flags as post-RC work.

## Production build settings

| App             | Setting                                                  | Status        |
| --------------- | -------------------------------------------------------- | ------------- |
| Backend         | `NODE_ENV=production`, `nest build`, Prisma generate     | ✅ Dockerfile |
| Next portals    | `next build`, `poweredByHeader: false`, security headers | ✅            |
| Images          | avif/webp                                                | ✅            |
| Package imports | `optimizePackageImports`                                 | ✅            |
