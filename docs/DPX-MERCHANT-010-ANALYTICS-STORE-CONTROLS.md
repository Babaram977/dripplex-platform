# DPX-MERCHANT-010 — Analytics + Store Controls

## 1. Scope (Merchant Phase 2, per founder's locked sequencing)

Continue Merchant Phase 2 UI work per the founder's locked sequencing
(`docs/DPX-COMMERCIAL-001-REVENUE-SETTLEMENT-CREDIT-POLICY.md` §0.1):
Reviews → Notifications → **Analytics + store controls (this doc)** →
module-level E2E/security/production-audit pass.

Give merchants a real analytics overview (orders, revenue, AOV, repeat
customers, delivery time, failed payments, cancellations, refunds, and a
per-period series) plus the two existing store-lifecycle controls
(pause/resume), using only existing backend capability. No new metrics,
KPIs, or store states were invented.

## 2. Reality audit

### 2.1 A second confirmed instance of the MerchantProfile.id/User.id bug

`AnalyticsService.getMerchantOverview(merchantId, input)` was called from
`MerchantAnalyticsController` as `getMerchantOverview(user.id, query)` and
passed that value straight through to `buildOverview()`, which filters
`Order`/`DeliveryJob`/`PaymentTransaction` by `merchantId` directly. But
those `merchantId` columns are `MerchantProfile.id` — the same split
already fixed for Reviews (DPX-MERCHANT-008) and established across
Orders/Merchants (`docs/DPX-MERCHANT-002-SETTLEMENT-DESIGN.md`). The
existing unit test masked this exactly the same way the Reviews test
did — by reusing one arbitrary `merchantId` constant for both the
"user id passed in" and the "value asserted in the where clause",
so the resolution step was never exercised.

**Net effect before this fix**: `GET /merchant/analytics/overview` always
returned zero orders, zero revenue, and zero everything else for every
real merchant — the KPI dashboard could never show real data. Fixed with
the identical pattern used in Reviews/Orders/Merchants: a
`requireMerchantProfile(userId)` helper that resolves `MerchantProfile.id`
before it's used as a filter, called at the top of `getMerchantOverview()`
only (`getAdminOverview()` — the platform-wide admin view — takes no
`merchantId` and was already correct).

Live-verified: before this fix, the analytics endpoint could never have
shown a real merchant anything but zeros; after the fix, `kpis.orders`
and `kpis.revenue` correctly reflect the merchant's own paid orders and
correctly exclude another merchant's orders in the same date range.

### 2.2 Store controls already existed, fully built

`POST /merchant/business/pause` / `POST /merchant/business/resume`
(`MerchantsService.pauseStore/resumeStore`) already existed, already
enforced the correct state machine (`ACTIVE → PAUSED → ACTIVE`, rejecting
a pause on an already-paused store), and the SDK (`MerchantApi.pauseStore/
resumeStore`) was already wired in Phase 1 (#377). No backend or SDK
changes were needed here — only a frontend gap: no UI called either
endpoint.

### 2.3 What was deliberately not built

- **No custom date-range picker.** The period selector (Daily/Weekly/
  Monthly/Yearly) drives the same `period` param the backend already
  reads; `from`/`to` default server-side to the last 30 days, exactly as
  `AnalyticsService.resolveRange()` already behaves. No calendar widget
  was added.
- **No charting library.** The series is rendered as a simple table
  (period / orders / revenue), consistent with `DPX-UX-001` Simplicity
  First and the fact that no charting dependency exists anywhere else in
  merchant-portal.
- **No top-products/top-customers breakdown.** `AnalyticsService.
topProducts()`/`topMerchants()` exist but are wired to the _admin_
  controller only (`AdminAnalyticsController`), not exposed to merchants
  by any existing route — adding a merchant-scoped version of either
  would be inventing new backend surface area, out of scope here.

## 3. Backend changes

- `AnalyticsService.getMerchantOverview()` — resolves `MerchantProfile.id`
  first (bug fix, §2.1); added `requireMerchantProfile()` helper, same
  shape as the Reviews/Orders precedent.
- No controller, DTO, or permission changes — `MerchantAnalyticsController`
  and `ANALYTICS_PERMISSIONS.MERCHANT_READ` (already granted to the
  `merchant` role) were already correct.
- No changes to `MerchantsService.pauseStore/resumeStore` or
  `merchant.controller.ts` — both already correct.

## 4. SDK

No changes. `AnalyticsClient.merchant(query)` (fixed in Phase 1, #375) and
`MerchantApi.pauseStore()/resumeStore()` (added in Phase 1, #377) already
covered the full contract this screen needed.

## 5. Frontend

### 5.1 `apps/merchant-portal/src/app/(dashboard)/analytics/page.tsx` (new)

- Period selector (Daily/Weekly/Monthly/Yearly), real `range.from`/
  `range.to` shown from the response.
- 8 real KPI cards: orders, revenue, AOV, repeat customers, avg delivery
  time, failed payments, cancelled orders, refunds — all straight from
  `AnalyticsOverview.kpis`, no derived/fabricated metrics.
- Per-period series table (period / orders / revenue) from the real
  `series` array; empty state when there's no activity in range.
- Loading spinner on first load, inline `role="alert"` error text, 15s
  polling — same pattern as every other Phase 2 list/detail screen.
- Nav item added to `sidebar.tsx` and `mobile-nav-drawer.tsx`
  (`TrendingUp` icon, positioned after Notifications).

### 5.2 `apps/merchant-portal/src/app/(dashboard)/business/page.tsx` — new `StoreControlsCard`

- Only rendered once the store has actually launched (`status === 'ACTIVE'
|| 'PAUSED'`) — matches the backend's own gate (`pauseStore` requires
  `ACTIVE`, `resumeStore` requires `PAUSED`).
- **Active state**: optional pause-reason input + "Pause store" button,
  with copy honestly describing the real effect (hides the store, blocks
  new orders, doesn't touch existing orders — verified against
  `pauseStore`'s actual implementation, not assumed).
- **Paused state**: shows the real persisted `pauseReason` (if any) and a
  "Resume store" button.
- Inline `role="alert"` error text on failure (e.g. attempting to pause an
  already-paused store).

## 6. Live verification

Backend rebuilt and started against the real dev Postgres/Redis. A
temporary `verify-analytics-store.script.ts` created a real merchant user

- `MerchantProfile` + `ACTIVE` `Business`, a customer user, and two real
  `PAID`/`COMPLETED` `Order` rows scoped to the merchant's `MerchantProfile.
id` (plus one order belonging to a different existing merchant profile, to
  prove scoping), then logged in via the real `POST /auth/login/merchant`
  and drove the exact HTTP contract:

* `GET /merchant/analytics/overview?from=...&to=...&period=daily` →
  `kpis.orders === 2`, `kpis.revenue === 8000` (5000+3000) — **this is the
  proof the §2.1 bug fix works**; before the fix this always returned
  zeros for every real merchant.
* Unauthenticated request → `401`.
* `POST /merchant/business/pause` (with reason) → `201`, `status:
'PAUSED'`, real `pausedAt` timestamp, `pauseReason` persisted exactly as
  sent.
* Pausing again while already paused → correctly rejected (`422`).
* `POST /merchant/business/resume` → `201`, `status: 'ACTIVE'`,
  `pausedAt`/`pauseReason` both cleared to `null`.

All 19 assertions passed. Fixtures were deleted at the end of the run; the
script file was deleted after; confirmed zero leftover fixture rows; the
dev backend process was stopped.

**Debugging note (transparency, not a code defect)**: mid-verification the
endpoint intermittently returned `orders: 0` against fixtures that direct
Prisma queries confirmed were correct and correctly scoped. Root-caused to
a stale/flaky `node dist/main.js` process left over from this session's
many rapid rebuild/restart cycles — a clean `pnpm run build` + fresh
process start resolved it immediately, and the fix's logic was independently
confirmed correct via direct Prisma queries and server-side debug logging
before and after. Documented here so the anomaly isn't mistaken for a
residual bug in `getMerchantOverview()` itself.

Backend suite: `pnpm exec jest --config ./jest.config.ts "src/analytics"`
→ **3 suites passed, 21/21 tests passed** (includes 1 new test for the
profile-resolution fix and 1 new test for the missing-profile rejection
path).

Frontend/SDK: `tsc --noEmit`, `eslint --max-warnings=0`, and `next build`
all clean, including the new `/analytics` route in the build output.

## 7. Files changed

- `apps/backend/src/analytics/analytics.service.ts` — bug fix + new
  `requireMerchantProfile()` helper.
- `apps/backend/src/analytics/analytics.service.spec.ts` — updated +
  new tests (profile resolution, missing-profile rejection).
- `apps/merchant-portal/src/app/(dashboard)/analytics/page.tsx` — new.
- `apps/merchant-portal/src/app/(dashboard)/business/page.tsx` — new
  `StoreControlsCard`.
- `apps/merchant-portal/src/components/layout/sidebar.tsx` /
  `mobile-nav-drawer.tsx` — nav item.

## 8. Next step

Merchant Phase 2's screen-by-screen build is now complete (Incoming
Orders, Business Profile, Onboarding/KYC, Wallet & Bank, Reviews,
Notifications, Analytics + store controls). Continue with the
module-level pass: full E2E verification of the order lifecycle workflow
(#389), security review (#390), then production audit + docs + commit/push
(#391) before Merchant Phase 2 is frozen and DPX-COMMERCIAL-001
implementation resumes per the founder's locked sequencing.
