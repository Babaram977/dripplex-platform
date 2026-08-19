# DPX-OPS-001 — Admin endpoints with no caller

**Swept:** 2026-08-19, after the fourth production incident in one night caused by the
same thing: a complete, permission-guarded backend endpoint that nothing on the front
ever called.

Those four were the promo card, the Bill Payments desk, the pricing console, and —
the one that stopped the platform working — **driver approval**. Six drivers passed
every activation check and sat `PENDING`, because `POST /admin/driver/:id/approve`
had existed since the onboarding work and no screen called it. Dispatch only offers
rides to `APPROVED` drivers, so no passenger could book a ride at all.

Each surfaced as an outage rather than as a gap. This is the sweep that finds the rest
before they do.

## Method, and what the numbers do not mean

Routes were extracted from every `*.controller.ts` whose `@Controller` prefix is
`admin` or `operations`, then matched against call sites in the super app, the four
portals, customer-web and the SDK — accounting for both the super app's
`dx('VERB', '/path')` shape and the SDK's `http.request('/path', { method })` shape.

|                                        |         |
| -------------------------------------- | ------- |
| admin/ops routes                       | **174** |
| no caller in **any** client            | **52**  |
| not reachable from the **Ops Console** | **115** |

Two honest caveats:

- **Uncalled is not the same as broken.** Most of these are features nobody has built a
  screen for yet — that is a roadmap question, not a defect. The count is a map, not a
  bug list.
- The matcher is textual. A route assembled from variables at runtime would read as
  uncalled. Spot-checks were run against routes known to be wired (the operations
  queues, `/admin/utilities/purchases`, `/admin/rides/pricing/*`) and all three are
  correctly absent from these lists.

## Class A — a desk exists, the action does not

These are the ones shaped like the driver-approval bug: an operator is on a page whose
job needs this endpoint, and the button is missing. **38 routes.**

### `customer-kyc`

- `POST /admin/customer-kyc/:kycId/reject`
- `POST /admin/customer-kyc/:kycId/request-resubmission`
- `POST /admin/customer-kyc/:kycId/verify`
- `GET /admin/customer-kyc/pending`
- `GET /admin/customer-kyc/user/:userId`

### `driver`

- `GET /admin/driver/:id/activation-eligibility`

### `driver-planned-availability`

- `GET /admin/driver-planned-availability` **(no client anywhere)**

### `driver-shifts`

- `GET /admin/driver-shifts` **(no client anywhere)**
- `PATCH /admin/driver-shifts/:id/end`

### `drivers`

- `POST /admin/drivers/:id/identity-verification/require`
- `POST /admin/drivers/:id/identity-verification/unlock`
- `GET /admin/drivers/security-settings`
- `PATCH /admin/drivers/security-settings`

### `inspection-centres`

- `GET /admin/inspection-centres`
- `POST /admin/inspection-centres`
- `GET /admin/inspection-centres/:id`
- `PATCH /admin/inspection-centres/:id`

### `merchant`

- `GET /admin/merchant/:id`

### `promotions`

- `DELETE /admin/promotions/:id`
- `GET /admin/promotions/:id`
- `GET /admin/promotions/:id/analytics` **(no client anywhere)**
- `POST /admin/promotions/:id/archive`
- `POST /admin/promotions/:id/clone`
- `GET /admin/promotions/:id/export` **(no client anywhere)**
- `GET /admin/promotions/analytics/top` **(no client anywhere)**

### `ride-reports`

- `GET /admin/ride-reports` **(no client anywhere)**
- `POST /admin/ride-reports/:id/resolve`

### `rider`

- `GET /admin/rider/:id`

### `rides`

- `POST /admin/rides/:id/refund` **(no client anywhere)**
- `GET /operations/rides/:id`
- `GET /operations/rides/:id/allocation`
- `GET /operations/rides/:id/dispatch-candidates`
- `GET /operations/rides/:id/tracking`

### `wallet`

- `GET /admin/wallet/withdrawals` **(no client anywhere)**
- `POST /admin/wallet/withdrawals/:id/fail`

### `wallets`

- `POST /admin/wallets/:ownerType/:ownerId/credit`
- `POST /admin/wallets/:ownerType/:ownerId/debit`
- `GET /admin/wallets/reconciliation` **(no client anywhere)**

### The one worth looking at first

`admin/customer-kyc` — customer KYC has a **founder-locked lifecycle**
(`NOT_STARTED → IN_PROGRESS → PENDING_REVIEW → VERIFIED | REJECTED | EXPIRED |
REQUIRES_RESUBMISSION`) and a complete admin API with an SDK client. **No Ops Console
screen calls any of it.** If customers can submit KYC, `PENDING_REVIEW` is a queue that
fills up and nobody can action — the same shape as six drivers stuck on `PENDING`,
with the same ending.

Worth confirming whether customers can submit at all before treating it as urgent; if
they cannot, this is dormant rather than bleeding.

## Class B — no console surface at all

Whole areas with no desk. Not defects; unbuilt product. Listed so the decision to build
or drop each one is deliberate. **77 routes.**

### `addresses`

- `GET /admin/addresses/:id` **(no client anywhere)**

### `analytics`

- `GET /admin/analytics/overview` **(no client anywhere)**
- `GET /admin/analytics/top-merchants` **(no client anywhere)**
- `GET /admin/analytics/top-products` **(no client anywhere)**
- `GET /admin/analytics/top-riders` **(no client anywhere)**
- `GET /operations/analytics/dispatch` **(no client anywhere)**
- `GET /operations/analytics/driver-utilization` **(no client anywhere)**
- `GET /operations/analytics/geography` **(no client anywhere)**
- `GET /operations/analytics/response` **(no client anywhere)**
- `GET /operations/analytics/rides` **(no client anywhere)**
- `GET /operations/analytics/shifts` **(no client anywhere)**

### `carts`

- `GET /admin/carts/:id` **(no client anywhere)**

### `cases`

- `GET /operations/cases/:id`

### `cms`

- `GET /admin/cms/contents` **(no client anywhere)**
- `POST /admin/cms/contents`
- `DELETE /admin/cms/contents/:id` **(no client anywhere)**
- `GET /admin/cms/contents/:id`
- `PATCH /admin/cms/contents/:id`
- `POST /admin/cms/contents/:id/archive` **(no client anywhere)**
- `POST /admin/cms/contents/:id/publish`
- `POST /admin/cms/contents/:id/schedule`

### `commercial`

- `GET /admin/commercial/accounts/:ownerType/:ownerId`
- `GET /admin/commercial/accounts/:ownerType/:ownerId/ledger` **(no client anywhere)**
- `POST /admin/commercial/accounts/:ownerType/:ownerId/payments`
- `GET /admin/commercial/commission-settings`
- `PATCH /admin/commercial/commission-settings`
- `PATCH /admin/commercial/credit-settings`
- `GET /admin/commercial/credit-settings/:ownerType`

### `delivery`

- `GET /admin/delivery/:id`
- `POST /admin/delivery/:id/cancel`
- `POST /admin/delivery/:id/reassign`

### `fraud`

- `GET /admin/fraud/list-entries` **(no client anywhere)**
- `POST /admin/fraud/list-entries`
- `DELETE /admin/fraud/list-entries/:id`
- `PATCH /admin/fraud/list-entries/:id`
- `GET /admin/fraud/queue` **(no client anywhere)**
- `POST /admin/fraud/signals/:id/clear`
- `POST /admin/fraud/signals/:id/confirm`
- `POST /admin/fraud/signals/:id/review`
- `GET /admin/fraud/thresholds`
- `PATCH /admin/fraud/thresholds/:key`

### `loyalty`

- `GET /admin/loyalty/:userId` **(no client anywhere)**
- `GET /admin/loyalty/achievements` **(no client anywhere)**
- `POST /admin/loyalty/achievements` **(no client anywhere)**
- `DELETE /admin/loyalty/achievements/:id` **(no client anywhere)**
- `PATCH /admin/loyalty/achievements/:id` **(no client anywhere)**

### `merchant-settlement`

- `GET /admin/merchant-settlement/commission` **(no client anywhere)**
- `PATCH /admin/merchant-settlement/commission` **(no client anywhere)**

### `notifications`

- `POST /admin/notifications/:id/resend` **(no client anywhere)**
- `POST /admin/notifications/broadcast` **(no client anywhere)**
- `GET /admin/notifications/templates` **(no client anywhere)**
- `POST /admin/notifications/templates` **(no client anywhere)**
- `DELETE /admin/notifications/templates/:code` **(no client anywhere)**
- `GET /admin/notifications/templates/:code` **(no client anywhere)**
- `PATCH /admin/notifications/templates/:code` **(no client anywhere)**

### `orders`

- `GET /admin/orders` **(no client anywhere)**
- `GET /admin/orders/:id`
- `GET /admin/orders/:id/payment-proofs` **(no client anywhere)**
- `PATCH /admin/orders/:id/refund` **(no client anywhere)**
- `PATCH /admin/orders/disputes/:disputeId/resolve` **(no client anywhere)**

### `referral-campaigns`

- `GET /admin/referral-campaigns` **(no client anywhere)**
- `POST /admin/referral-campaigns`
- `GET /admin/referral-campaigns/:id/export` **(no client anywhere)**
- `GET /admin/referral-campaigns/:id/leaderboard`
- `POST /admin/referral-campaigns/:id/pause`
- `POST /admin/referral-campaigns/:id/resume`
- `PATCH /admin/referral-campaigns/:id/rewards`
- `GET /admin/referral-campaigns/fraud-checks` **(no client anywhere)**
- `POST /admin/referral-campaigns/fraud-checks/:id/review`
- `GET /admin/referral-campaigns/rewards` **(no client anywhere)**
- `POST /admin/referral-campaigns/rewards/:id/approve`
- `POST /admin/referral-campaigns/rewards/:id/pay`
- `POST /admin/referral-campaigns/rewards/:id/reject`

### `referrals`

- `GET /admin/referrals/redemptions` **(no client anywhere)**

### `reviews`

- `PATCH /admin/reviews/:id/moderate` **(no client anywhere)**

### `search`

- `POST /admin/search/documents` **(no client anywhere)**

### `staff`

- `GET /operations/staff`

## Recommendation

1. Close Class A. Each is a button on a page that already exists — hours, not weeks,
   and each one removes a way for the platform to silently stop working.
2. Triage Class B by area and decide build-or-drop. An endpoint kept without a caller
   is a maintenance cost and, as tonight showed, a trap.
3. Keep this honest automatically. This sweep is a fifty-line script; run it in CI and
   fail on a _new_ uncalled admin endpoint. That converts the whole class of bug from
   an outage into a build failure.
