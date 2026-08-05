# DPX-MERCHANT-013 — Merchant Phase 2 Production Audit

## 1. Scope (Merchant Phase 2, per founder's locked sequencing)

Third and final step of the founder's locked module-completion sequence
(E2E → security review → **production audit** → founder review → freeze).
Scope as explicitly specified: Module completeness, SDK coverage,
Merchant Portal coverage, Documentation, Performance, Error handling,
Production readiness.

This is a read-only audit pass — no production code was changed. Findings
are recorded honestly, including one that corrects an inaccurate claim
made in an earlier report (§2.1).

## 2. Module completeness

### 2.1 Correction: the Merchant Portal build is not fully complete

DPX-MERCHANT-010 (§8, "Next step") stated *"Merchant Phase 2's
screen-by-screen build is now complete (Incoming Orders, Business
Profile, Onboarding/KYC, Wallet & Bank, Reviews, Notifications, Analytics

- store controls)."* **That was inaccurate.** Task #381 — "Phase 2:
  Merchant Portal — Home/Overview screen" — was never actually completed
  and remains `pending` in the tracker; it was overlooked when that claim
  was written.

The current `apps/merchant-portal/src/app/(dashboard)/page.tsx` is a
**Phase 1 artifact**, not a Phase 2 screen: it shows only three product
counters (total/published/draft) and a backend-status panel. It predates
— and doesn't reflect — everything built in Phase 2. A merchant landing
on their dashboard today sees product stats only, with no visibility into
the far more important signals Phase 2 actually built: pending orders
needing action, wallet balance, unread notifications, or a recent-activity
summary. Every one of those now has a real, live backend endpoint
(`GET /merchant/orders?status=CONFIRMED`, `GET /merchant/wallet`,
`GET /merchant/notifications`, `GET /merchant/analytics/overview`) that
the Home screen simply doesn't call.

This is flagged as a genuine, unresolved gap for founder decision — not
silently fixed here, since building new UI is exactly the kind of scope
expansion this audit pass should surface rather than absorb. Options for
the founder: (a) build the real Phase 2 Home/Overview screen before
freeze, (b) accept the current Phase 1 page as sufficient for freeze and
schedule the upgrade separately, or (c) something else. Recommendation:
(a) — every other Phase 2 screen the merchant needs already exists and
is wired; the missing piece is purely a landing-page aggregation view, a
half-day of frontend work with zero backend/SDK gaps to close.

### 2.2 Everything else in Phase 2's screen list is real and live-verified

Incoming Orders, Business Profile, Onboarding/KYC, Wallet & Bank,
Reviews, Notifications, and Analytics + store controls were each
individually live-verified against the real backend at the time they
were built (DPX-MERCHANT-007 through -010), and the full order lifecycle
crossing all of them together was re-verified end-to-end in
DPX-MERCHANT-011. No regressions found.

## 3. SDK coverage

Cross-referenced all 42 endpoints across the 8 `merchant/*` backend
controllers against `packages/sdk/src/merchant/merchant-api.ts` and the
shared `NotificationsClient`/`OrderClient`/`PlatformClient` classes.

**One gap found**: `PATCH /merchant/products/:id/stock-status`
(`MerchantProductsController.setOutOfStock`) — a manual "mark this
product out of stock regardless of quantity" override — has **no SDK
client method**. Confirmed by grep across the entire SDK package: no
`stock-status` reference anywhere. Every other endpoint (orders,
products including images/variants/inventory, reviews, notifications,
wallet, settlements, analytics, business/kyc/bank-account) has full,
correctly-pathed SDK coverage.

Everything else already fixed in Phase 1 (`AnalyticsClient.merchant()`
path, `MerchantOrdersController` coverage, store pause/resume) remains
correct — re-confirmed, not re-broken.

## 4. Merchant Portal coverage

Cross-referenced the SDK surface against what the UI actually calls.

- **Orders**: `orders/[id]/page.tsx` wires all five lifecycle actions
  (`merchantAcceptOrder`, `merchantRejectOrder`, `merchantMarkOrderReady`,
  `merchantDelayOrder`, `merchantCancelOrder`) — full coverage, not just
  accept/ready.
- **Products**: create/edit/publish/unpublish/delete/images/variants/
  inventory are all wired. The one SDK gap in §3 means the backend's
  manual out-of-stock toggle has **no UI entry point either** — a
  merchant can only affect stock status indirectly by setting quantity
  to 0 via `updateInventory`, not via the dedicated override. Low
  severity (the indirect path works for the common case) but worth
  closing alongside the SDK gap.
- **Business/KYC/Bank/Wallet/Reviews/Notifications/Analytics**: each
  screen calls the full read/write surface its backend controller
  exposes; no additional gaps found beyond §2.1's Home/Overview finding.

## 5. Documentation

- DPX-MERCHANT-007 through -012 (Reviews, Notifications, Analytics +
  store controls, E2E verification, Security review) are internally
  consistent with each other and with the current code — spot-checked
  route paths, DTO field names, and permission constants named in each
  doc against the live source in this pass; no drift found.
- **This audit corrects the one inaccurate completeness claim** found
  (§2.1, in DPX-MERCHANT-010).
- **Correction (post-publish):** this section originally cited
  `docs/ops/PRODUCTION-COOLIFY.md` as the relevant deployment doc to
  extend. That was wrong — Railway, not Coolify, has been the canonical
  production platform since 2026-08-03 (`docs/ops/PRODUCTION-RAILWAY.md`
  header; Coolify's doc is explicitly parked, not canonical). The
  founder reaffirmed this and locked it as the standing platform
  decision for all future deployment work. `docs/ops/PRODUCTION-RAILWAY.md`
  explicitly documents that `merchant-portal` deployment is **not yet
  covered** (its own "Known gaps" section: "`merchant-portal`,
  `rider-portal` have never been deployed anywhere, and have no
  Dockerfile-based deploy recipe documented yet" — though a Dockerfile
  does in fact exist at `apps/merchant-portal/Dockerfile`, so that doc's
  gap note is itself slightly stale) — flagged again below under
  Production readiness (§8) since it's directly relevant to
  freeze-readiness.

## 6. Performance

- **Pagination is universally bounded.** Every merchant list endpoint
  (`orders`, `products`, `reviews`, `settlements`, `wallet/transactions`,
  `notifications`) validates `pageSize`/`limit` with `@Max(100)` (or
  equivalent) — no endpoint allows an unbounded page size that could be
  used to pull an entire table in one request.
- **Indexes exist on every merchant-scoped filter column** actually used:
  `Order.merchantId`, `Product.merchantId`, `BankAccount.merchantId`
  (plus a composite `[merchantId, isDefault]`), `Review.targetId`. No
  merchant list query filters on an un-indexed column.
- **Minor, non-blocking optimization opportunity**: `Order` has separate
  single-column indexes on `merchantId` and `status` rather than a
  composite `[merchantId, status]` index, and `MerchantOrdersService.
listOrders()` filters by both together (the Incoming Orders screen's
  primary query, e.g. `?status=CONFIRMED`). At current and near-term
  scale this is not a problem (Postgres can combine two single-column
  index scans efficiently), but it's the kind of thing worth adding if/
  when a merchant's order volume grows large enough for it to matter —
  noted here rather than acted on, since it's a proactive tuning
  suggestion, not a defect.
- No N+1 query pattern found in any merchant list/detail path reviewed —
  `include`/`select` are used consistently instead of per-row follow-up
  queries.

## 7. Error handling

- Confirmed via the live security-review script (DPX-MERCHANT-012): every
  error path returns the correct HTTP status via `GlobalExceptionFilter`
  — `401` for missing/invalid auth, `403` for a wrong-role JWT with a
  correct-shaped token, `404` for cross-merchant resource access (not a
  403 that would leak existence), `400` for validation failures
  (unrecognized fields, wrong types, out-of-range values, invalid enum
  values).
- Every mutating merchant service method wraps its Prisma write in an
  audit-log call (`AuditService.record(...)`) — confirmed present on all
  of orders/products/reviews/bank-account/notifications' mutating paths
  reviewed in DPX-MERCHANT-012 §3.
- No unhandled-promise or silently-swallowed-error pattern found in the
  merchant service files read across this and the two prior audit passes.

## 8. Production readiness

- **Backend**: no schema, service, or controller changes needed for
  freeze — DPX-MERCHANT-011's E2E pass and DPX-MERCHANT-012's security
  pass both exercised the real, deployed code paths successfully.
- **Merchant Portal deployment**: `apps/merchant-portal/Dockerfile`
  exists and follows the same proven multi-stage pattern as
  `driver-portal`/`admin-portal`/`customer-web`, but
  `docs/ops/PRODUCTION-RAILWAY.md` (canonical) has no merchant-portal
  Railway service/domain/env-var section yet — the same gap that exists
  for `driver-portal`/`operations-console` before they were deployed
  there. **This should be closed before or immediately after freeze** —
  the module isn't genuinely production-ready until there's a documented
  path to actually deploying it on the platform DrippleX actually runs
  on, even though the underlying backend/SDK/UI work is done.
- **Environment variables**: `merchant-portal` uses the same
  `NEXT_PUBLIC_API_BASE_URL` pattern as every other frontend app; no new
  environment variable was introduced by any Phase 2 screen (confirmed —
  none of DPX-MERCHANT-007 through -010 added new env vars).
- **Outstanding, correctly-out-of-scope items** (confirmed real,
  intentionally not fixed in this module, per DPX-MERCHANT-011 §4):
  merchant in-app order-lifecycle notifications (email-only today), no
  rider-facing notifications route, and the admin/operations-console
  login route gap discovered incidentally. None of these block Merchant
  module freeze — they are either genuinely out of this module's
  boundary (rider notifications, admin auth) or a documented, deliberate
  scope decision (merchant in-app notifications) rather than a defect
  introduced by this work.

## 9. Summary of findings requiring a decision before/around freeze

| #   | Finding                                                                        | Severity                                                                                 | Recommendation                                                       |
| --- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | Home/Overview screen is a stale Phase 1 page, not a real Phase 2 screen (§2.1) | Medium — visible on every merchant login, but every underlying capability already exists | Build it before freeze (half-day, no backend/SDK work needed)        |
| 2   | `stock-status` endpoint has no SDK method or UI (§3, §4)                       | Low — indirect workaround (`updateInventory` to 0) exists                                | Add SDK method + a small UI affordance; not urgent                   |
| 3   | Merchant Portal not yet in `PRODUCTION-RAILWAY.md` (§8)                        | Medium — blocks an actual production deploy, not the code itself                         | Add a merchant-portal Railway service section before real deployment |

None of these three are defects in what was built — they are honest,
bounded gaps consistent with the founder's own observation that a
reality-driven process is meant to surface exactly this kind of thing
before launch, not after.

## 10. Next step

Present this audit, DPX-MERCHANT-011 (E2E), and DPX-MERCHANT-012
(security review) for **Founder Review**. Pending that review and a
decision on §9's three items, freeze the Merchant module and resume
DPX-COMMERCIAL-001 per the founder's locked sequencing.

## 11. 🔒 Founder Approved & Frozen (2026-08-05)

§9's finding #1 (Home/Overview stale) was closed before Founder Review —
the founder approved building the real screen (task #381), locked design
constraints (DDS-composed, no Figma-locked/shared component changes) and
implementation constraints (no new backend/SDK/schema, existing endpoints
only), and the result was folded into this module's E2E/security/audit
trilogy as `docs/DPX-MERCHANT-014-HOME-OVERVIEW-SCREEN.md`. Findings #2
(`stock-status` SDK/UI gap) and #3 (merchant-portal not yet in
`PRODUCTION-RAILWAY.md`) were reviewed and explicitly classified
non-blocking by the founder — #3 deferred to platform-wide Railway
production-readiness work before Ride launch (tracked, see
`docs/ops/PRODUCTION-RAILWAY.md`), #2 deferred as a low-severity,
non-urgent enhancement.

The founder then issued Founder Review — DPX-MERCHANT-001 Phase 2, outcome
**Approved**, and:

> 🔒 DPX-MERCHANT-001 — Merchant Module — Approved & Frozen
>
> Apply the standard freeze policy: Critical security fixes only, Critical
> defect fixes only, Performance improvements, Compliance updates,
> Explicit Founder-approved enhancements. No routine feature additions.

This production audit, together with DPX-MERCHANT-011 (E2E),
DPX-MERCHANT-012 (security review), and DPX-MERCHANT-014 (Home/Overview
addendum), is the closing record of Merchant Phase 2. No further findings
in this document are open. See `docs/DPX-MERCHANT-001-REALITY-AUDIT.md`
§13 and `docs/RELEASE-HISTORY.md` for the consolidated freeze record.
