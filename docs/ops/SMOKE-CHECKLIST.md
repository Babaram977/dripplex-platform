# Staging / production smoke checklist

Sign each section after exercise. Product UI gaps from Program C2 remain; mark N/A where UI is not shipped and exercise SDK/admin API instead.

**Release:** `1.0.0`  
**Environment:** _______________  
**Tester:** _______________  
**Date:** _______________

> For production cutover, also complete `docs/ops/PRODUCTION-VALIDATION.md` and `docs/ops/PRE-LAUNCH-CHECKLIST.md`.

## Customer

- [ ] Register
- [ ] Email verification
- [ ] Login / logout / refresh
- [ ] Dashboard loads authenticated
- [ ] Search probe (SDK/UI available)
- [ ] Notifications list (if UI)
- [ ] Wallet balance (if UI)
- [ ] Offline fallback page when network disabled (PWA)
- [ ] Manifest / installability (browser install prompt where supported)
- [ ] N/A documented: cart/checkout/payment UI (SDK ready — C2 BLOCKED-UI)

## Merchant

- [ ] Login
- [ ] Dashboard status probes (business / KYC / wallet)
- [ ] Analytics overview (if exposed)
- [ ] N/A documented: product CRUD / order accept (BLOCKED-BE)

## Rider

- [ ] Login
- [ ] Availability / jobs list (SDK or UI)
- [ ] Accept → location → deliver path (staging job fixture)
- [ ] Wallet balance

## Admin

- [ ] Login
- [ ] CMS read/publish (if UI)
- [ ] Fraud queue observational mode
- [ ] Wallet credit/debit idempotent
- [ ] Broadcast notification (staging only)

## Authentication

- [ ] Wrong password → 401, no session clear on public routes
- [ ] Refresh rotation works across portal reload
- [ ] Locked / rate-limited login behaves as expected
- [ ] Portal auth gates redirect unauthenticated users

## Payments

- [ ] Initiate pay (test keys) / verify callback on staging
- [ ] Failure path returns 422 envelope
- [ ] Webhook signature rejected when invalid

## Wallet

- [ ] Customer / merchant / rider balances readable
- [ ] Admin ledger adjustment audited

## Notifications

- [ ] List for authenticated user
- [ ] Mark read (if UI)

## Search

- [ ] Query returns documents
- [ ] Popular endpoint OK

## Orders

- [ ] Customer order get/history via API or UI
- [ ] Delivery tracking payload OK
- [ ] Merchant order lifecycle N/A (BLOCKED-BE)

## Analytics

- [ ] Merchant analytics endpoint
- [ ] Admin analytics endpoint

## Fraud

- [ ] Observational mode: `blocked` remains false
- [ ] Queue visible to admin role

## CMS

- [ ] Publish / unpublish content
- [ ] Public read of published content

## Sign-off

| Role | Name | Ready for staging approval? |
| ---- | ---- | --------------------------- |
| QA   |      | Yes / No                    |
| Eng  |      | Yes / No                    |
| Ops  |      | Yes / No                    |

**Production deployment requires signed pre-launch checklist + go-live runbook (`docs/ops/GO-LIVE.md`).**
