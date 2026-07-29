# Production validation — Dripplex v1.0.0

Run after cutover. Prefer authenticated staging-trained testers with **production** credentials (or restricted production pilot accounts).

**Release:** `1.0.0`  
**Environment:** production  
**Tester:** _______________  
**Date:** _______________

Automated baseline:

```bash
bash scripts/golive/validate-production.sh
```

## Authentication

- [ ] Customer registration + email/OTP verification
- [ ] Customer login / logout / refresh
- [ ] Merchant login
- [ ] Rider login
- [ ] Admin login
- [ ] Wrong password → 401; sessions list requires auth

## Search & catalog

- [ ] Search popular / query returns documents
- [ ] Product detail readable (API or UI)

## Orders & payments

- [ ] Create / view customer order (pilot path)
- [ ] Payment initiate + webhook (live or controlled pilot)
- [ ] Failure path returns expected envelope
- [ ] Order lifecycle visible to customer

## Wallet

- [ ] Customer wallet balance
- [ ] Merchant wallet balance
- [ ] Rider wallet balance
- [ ] Admin reconciliation / adjustment audited

## Notifications

- [ ] Customer notification list
- [ ] Mark read (if UI)

## Platform ops

- [ ] Analytics overview (merchant + admin)
- [ ] CMS publish / public read
- [ ] Fraud queue observational (admin)
- [ ] Audit logs present for sensitive actions

## Smoke matrix

| Area                  | Pass |
| --------------------- | ---- |
| Customer portal       | [ ]  |
| Merchant portal       | [ ]  |
| Rider portal          | [ ]  |
| Admin portal          | [ ]  |
| Payment               | [ ]  |
| Wallet                | [ ]  |
| Order lifecycle       | [ ]  |
| Notifications         | [ ]  |
| API health            | [ ]  |
| Database (via health) | [ ]  |
| Redis (via health)    | [ ]  |

## Monitoring verification

- [ ] Grafana: Platform Overview green
- [ ] Prometheus: targets up
- [ ] Loki: backend + nginx logs flowing
- [ ] Sentry: release `1.0.0` / `v1.0.0` receiving events (or quiet with health ping)
- [ ] Status page: components operational
- [ ] Alertmanager: test page / silence hygiene OK

## Sign-off

| Role | Name | Production healthy? |
| ---- | ---- | ------------------- |
| QA   |      | Yes / No            |
| Eng  |      | Yes / No            |
| Ops  |      | Yes / No            |

If **No** → execute `docs/ops/ROLLBACK.md` and open incident.
