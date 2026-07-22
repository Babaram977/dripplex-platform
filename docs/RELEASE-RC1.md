# Release Candidate RC1 — `1.0.0-rc.1`

**Date:** 2026-07-22  
**Program:** C4 — Release Candidate & Deployment Readiness  
**Freeze:** Source freeze for staging approval. No new features, UI redesign, Backend API, schema, or non-blocker SDK changes.

## Summary

Dripplex monorepo is versioned **`1.0.0-rc.1`** across Backend, SDK, Customer, Merchant, Rider, Admin, Operations, and shared packages. Program A–C3 remain locked; C4 adds release metadata, production/ops documentation, customer PWA baseline, staging compose, CI quality workflow, and portal favicon metadata.

## Resolved issues (this candidate)

- Version consistency across workspace packages → `1.0.0-rc.1`
- Customer PWA: manifest, service worker, offline fallback, theme colours, icon metadata
- Portal favicons / apple touch icon references (SVG placeholders)
- Shared security headers retained from C3 (CSP, HSTS in prod)
- Deployment, rollback, backup, smoke, and production-config runbooks under `docs/ops/`
- GitHub Actions CI for typecheck / lint / test / build
- Staging docker-compose for Postgres + Redis + backend

## Known issues

| ID    | Issue                                                                            | Severity                    | Mitigation                                                        |
| ----- | -------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------- |
| KI-01 | Official brand vectors unavailable; SVG marks are palette-compliant placeholders | Branding blocker            | `docs/TODO-BRAND-ASSETS.md` — only branding blocker for GA polish |
| KI-02 | No PNG apple-touch / splash raster set                                           | Low                         | SVG apple icons; add official PNGs with brand assets              |
| KI-03 | JWT access/refresh in web storage (XSS residual)                                 | Medium (accepted C3)        | CSP + no PII in persist; httpOnly cookies post-freeze             |
| KI-04 | CSP requires `script-src 'unsafe-inline'`                                        | Low                         | Required for Next + theme bootstrap                               |
| KI-05 | No Sentry/OTel / web crash SDK                                                   | Medium (ops)                | Health + audit exist; wire APM in staging                         |
| KI-06 | Catalog / store / product browse APIs absent                                     | Product gap (C2 BLOCKED-BE) | Out of freeze; document for next program                          |
| KI-07 | Merchant order lifecycle APIs absent                                             | Product gap (C2 BLOCKED-BE) | Out of freeze                                                     |
| KI-08 | Many commerce UIs not built (cart/checkout UI etc.)                              | Product gap (C2 BLOCKED-UI) | SDK contracts validated                                           |
| KI-09 | Live staging E2E not run in agent environment                                    | Process                     | Smoke checklist required before approval                          |
| KI-10 | PWA is offline-fallback only (not full offline commerce)                         | Low                         | Matches DPX-F009 incremental approach                             |

## Deferred items

- Official brand asset swap + PNG splash / maskable set
- httpOnly cookie session migration (Backend Core change)
- Full APM, crash reporting, product analytics SDKs
- Frontend Dockerfiles for every portal (customer-web provided; others host-native OK)
- Kubernetes / Helm charts
- Merchant catalog & order APIs + product UIs (post-freeze programs)
- Dependency upgrades beyond audit remediation policy

## Breaking changes

None relative to locked Backend Core + C1–C3 integration surface.

## Upgrade notes

1. Set all workspace consumers to `1.0.0-rc.1` (already aligned in monorepo).
2. Use `.env.example` → secret manager; set `NODE_ENV=production` and HTTPS `NEXT_PUBLIC_API_BASE_URL`.
3. Deploy DB with `prisma migrate deploy` only.
4. Customer-web will register `/sw.js` — ensure HTTPS and that offline page is reachable.
5. Tighten `CORS_ORIGINS` to exact portal origins.
6. Run `docs/ops/SMOKE-CHECKLIST.md` before signing staging approval.
7. **Do not promote to production until staging approval is explicit.**

## Recommendation

See `docs/PROGRAM-C4.md` § Recommendation.
