# Sentry APM setup (Program D3)

## Projects (create in Sentry UI)

| Project                     | Platform      | DSN env                                 |
| --------------------------- | ------------- | --------------------------------------- |
| dripplex-backend            | NestJS / Node | `SENTRY_DSN`                            |
| dripplex-customer-web       | Next.js       | `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` |
| dripplex-merchant-portal    | Next.js       | same                                    |
| dripplex-rider-portal       | Next.js       | same                                    |
| dripplex-admin-portal       | Next.js       | same                                    |
| dripplex-operations-console | Next.js       | same                                    |

## Behaviour

- **No DSN ⇒ no-op** (local/CI unchanged).
- Backend: `initBackendSentry()` in `main.ts`; 5xx → `captureServerException` in global filter (response contract unchanged).
- Portals: `src/instrumentation.ts` registers `@sentry/nextjs`.
- `sendDefaultPii: false`; traces sample rate default 0.1 in prod template.

## Release tracking

Set `SENTRY_RELEASE` to image tag / git sha in Compose/CI (D2 publish can export `SENTRY_RELEASE=${SHA}`).

## Source maps

Upload during image build or a CI step with `sentry-cli` (recommended before GA). Not blocking D3 ops readiness if unhandled exceptions still capture.

## Alerts

Route Sentry issue alerts → `#dripplex-oncall` (duplicate with Alertmanager is OK for app errors).
