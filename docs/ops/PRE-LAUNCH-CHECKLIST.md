# Pre-launch checklist — Dripplex v1.0.0

Complete **before** running `EXECUTE=1 bash scripts/golive/go-live.sh` or the **Deploy Production** workflow.

**Release:** `1.0.0`  
**Operator:** _______________  
**Date:** _______________

## Production domains

| Surface              | Expected URL                    | Verified |
| -------------------- | ------------------------------- | -------- |
| Marketing / Customer | `https://www.dripplex.com`      | [ ]      |
| App (PWA / shell)    | `https://app.dripplex.com`      | [ ]      |
| API                  | `https://api.dripplex.com`      | [ ]      |
| Merchant             | `https://merchant.dripplex.com` | [ ]      |
| Rider                | `https://rider.dripplex.com`    | [ ]      |
| Admin                | `https://admin.dripplex.com`    | [ ]      |
| Status               | `https://status.dripplex.com`   | [ ]      |
| CDN                  | `https://cdn.dripplex.com`      | [ ]      |

## Cloudflare DNS & SSL

- [ ] DNS A/AAAA / CNAME records point at production edge
- [ ] Proxied (orange cloud) where intended
- [ ] Universal SSL / Full (strict) to origin
- [ ] Certificates valid ≥ 30 days
- [ ] HSTS enabled at edge (or via app headers)

## GitHub Environment Secrets (`production`)

- [ ] `PROD_DEPLOY_HOST` / `PROD_DEPLOY_USER` / `PROD_SSH_KEY`
- [ ] `DATABASE_URL` / `REDIS_URL`
- [ ] `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
- [ ] Payment keys (`PAYSTACK_*` / Flutterwave as used)
- [ ] `R2_*` object storage
- [ ] SMTP credentials
- [ ] SMS provider credentials
- [ ] `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`
- [ ] `SLACK_WEBHOOK_URL`
- [ ] Variables: `PROD_API_BASE_URL`, portal URLs, `DEPLOY_MODE=ssh`

## Data plane

- [ ] Production Postgres provisioned + backup schedule active
- [ ] PgBouncer / connection limits reviewed
- [ ] Redis production instance + persistence policy
- [ ] Object storage buckets (`uploads`, backups) created
- [ ] Pre-migrate backup taken (see `docs/ops/BACKUPS.md`)

## Mobile / push (store may still be beta)

- [ ] Firebase project + `google-services.json` (if shipping Android)
- [ ] Apple APNS key / entitlements production
- [ ] Or accept: web-only launch; mobile store deferred (D4 NOT READY)

## Messaging & payments

- [ ] SMTP verified (send test)
- [ ] SMS provider verified (OTP test on staging)
- [ ] Payment gateway **live** keys (or confirmed test-mode freeze)
- [ ] Webhook URLs registered for production API host

## Monitoring & status

- [ ] Grafana dashboards imported
- [ ] Prometheus scraping production targets
- [ ] Loki receiving logs
- [ ] Sentry projects receiving events
- [ ] Alertmanager → Slack wired
- [ ] Status page monitors online

## Approvals

| Gate                          | Approver | Sign-off |
| ----------------------------- | -------- | -------- |
| Eng lead                      |          | [ ]      |
| Ops / SRE                     |          | [ ]      |
| Product                       |          | [ ]      |
| Security (secrets + payments) |          | [ ]      |

**Do not proceed to cutover until all critical rows above are checked.**
