# Dripplex Release Notes — v1.0.0

> **⚠️ Superseded — not an accurate record of current state.** No `v1.0.0` git tag was ever created, and `docs/AUDIT-PRODUCTION-READINESS.md` (2026-07-28) found this document's claims about frontend completeness don't match the actual source tree: `customer-web` and `merchant-portal` have login/auth pages only, no cart/checkout/order/wallet/product-management UI. See `docs/AUDIT-PRODUCTION-READINESS.md` and `docs/ops/PRODUCTION-RAILWAY.md` for the current, verified state. Kept below as a historical record of what this release was intended to describe, not what actually shipped.

| Field           | Value                            |
| --------------- | -------------------------------- |
| **Version**     | `1.0.0`                          |
| **Codename**    | Production Launch                |
| **Date**        | 2026-07-22                       |
| **Predecessor** | `1.0.0-rc.1` (Program C4)        |
| **Program**     | D5 — Production Launch & Go-Live |

## What’s included

First production release of the Dripplex platform monorepo:

- **Backend Core** (Program A) — auth, commerce, wallet, payments, delivery, CMS, fraud observational, analytics, audit
- **Frontend ecosystem** (Program B/C) — customer-web (PWA), merchant, rider, admin, operations console
- **Production infrastructure** (D1) — Compose/K8s manifests, Cloudflare, backups, DR
- **CI/CD** (D2) — GHCR publish, staging/production deploy, migrations, smoke, rollback
- **Monitoring** (D3) — Sentry, Prometheus, Grafana, Loki, alerts, runbooks
- **Mobile packaging** (D4) — Capacitor customer shell + store drafts (store submission may remain gated)

## Constraints for this release

- No new features beyond locked Programs A–D4
- No UI redesign
- No Backend API / schema changes in D5
- No infrastructure redesign in D5

## Deploy

See `docs/ops/GO-LIVE.md`. Tag: `v1.0.0`.

## Known deferrals

| Item                            | Status                                 |
| ------------------------------- | -------------------------------------- |
| Official brand raster assets    | Deferred (`docs/TODO-BRAND-ASSETS.md`) |
| Public store submission         | Deferred (D4 NOT READY)                |
| Merchant/Rider native apps      | Web portals only                       |
| Full offline commerce PWA cache | Offline fallback only                  |
| Backend device push token API   | Post-1.0.0                             |

## Rollback

`docs/ops/ROLLBACK.md` · `scripts/cicd/rollback.sh`

## Support

- Status: `https://status.dripplex.com`
- Contact: `support@dripplex.com`
