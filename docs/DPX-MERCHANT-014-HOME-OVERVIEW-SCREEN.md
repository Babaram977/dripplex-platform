# DPX-MERCHANT-014 — Merchant Portal Home/Overview Screen (Task #381)

## 1. Scope and founder decision

DPX-MERCHANT-013 §2.1 (production audit) found that task #381 — the
Merchant Portal's Home/Overview screen — was never actually built; the
dashboard root page was still a stale Phase 1 view (product counters
only). The founder approved closing this gap before Merchant module
freeze, with two locked constraints:

**Design constraints (locked):**

- Stay fully aligned with the approved DrippleX Design System (DDS).
- Preserve the established visual language, spacing, typography, color
  tokens, navigation patterns, and shared UI components.
- Do not redesign, restyle, or modify any Figma-locked shared components
  or shared layouts.
- No recovered Merchant-specific Figma exists, so the dashboard is
  composed from existing DDS components/patterns already used across the
  platform, not a new design language.

**Implementation constraints (locked):** no new backend APIs, no schema
changes, no SDK changes, no new business logic — compose the screen from
the Orders, Wallet, Notifications, Analytics, and Business/Store Status
endpoints that already existed.

**Post-implementation requirement:** include the screen in Merchant E2E
verification, the Merchant security review, and the Merchant production
audit before returning for Founder Review. This document is that
addendum to DPX-MERCHANT-011/012/013.

## 2. What was built

`apps/merchant-portal/src/app/(dashboard)/page.tsx` was rewritten (one
file, nothing else touched — confirmed via `git diff --stat`) into a real
merchant daily dashboard:

- **Today's orders** — three counts (Pending/Preparing/Ready), each
  mapped to the real `OrderStatus` values `CONFIRMED`/`PREPARING`/`READY`.
- **Today's revenue** — `analytics.merchant({from: today, to: today,
period: 'daily'})`, `kpis.revenue`.
- **Wallet balance** — `merchant.getWallet()`, `availableBalance`.
- **Unread notifications** — `notifications.list({unreadOnly: true,
limit: 1})`, `total`.
- **Store status** — `merchant.getBusiness()`, `status` (`ACTIVE` →
  "Store open", `PAUSED`/other → "Store paused"; a 404 — no `Business`
  row yet — renders a "Set up your store" call-to-action instead of an
  error, matching the Business Profile screen's existing handling).
- **Recent reviews** — `reviews.listMerchant({page: 1, pageSize: 3})`,
  `items` + `aggregate.averageRating`/`reviewCount`.
- **Quick actions** — links to Orders, Products, Business, Wallet.

**Deliberately not built**: "Outstanding DrippleX commission" (from the
founder's original wish-list) — depends on DPX-COMMERCIAL-001, which
hasn't landed. No real data source exists for it; it was left out rather
than fabricated as a zero/placeholder value.

**Design-constraint compliance**: every widget is composed from the same
`Card`/`CardHeader`/`CardTitle`/`CardContent`/`Badge`/`Button`/
`LoadingSpinner` primitives from `@dripplex/ui` that Analytics, Orders,
Business, Wallet, Reviews, and Notifications already use — same
typography classes (`font-display`, `text-3xl font-semibold
tracking-tight`), same spacing (`gap-4`/`gap-6`/`max-w-4xl`), same color
tokens (`text-muted-foreground`, `text-destructive`), same star-rating
pattern already used on the Reviews screen. Nothing in `packages/ui`
(where Figma-locked shared components live) was touched. The sidebar/
mobile-nav already pointed `/` → "Overview"; no navigation change was
needed.

**Resilience**: each of the six data sections loads independently via
`Promise.allSettled` and holds its own `{data, error}` state, so one
failed call (e.g. a brand-new merchant with no `Business` row yet) never
blanks the rest of the dashboard — the same fail-soft principle every
other Phase 2 screen already follows, applied per-widget here instead of
per-page.

## 3. E2E verification

A temporary script, `verify-merchant-overview.script.ts` (written, run,
deleted — same methodology as every prior DPX-MERCHANT-00x pass), drove
the exact real HTTP endpoints and query parameters the Overview page
calls, with fixture data engineered to produce known, checkable results:
a merchant with a `Business` (`ACTIVE`), three `PAID` orders today (one
each in `CONFIRMED`/`PREPARING`/`READY`, totals 2000+3000+1500), one
`APPROVED` review, and one unread notification.

**26/26 assertions passed**:

- The three simultaneous small-`pageSize` status-count queries each
  returned `meta.total === 1` for their respective status.
- `GET /merchant/analytics/overview?from=<today>&to=<today>&period=daily`
  (the exact `from === to` range Overview uses, not previously exercised
  by DPX-MERCHANT-011's E2E pass, which used a running date range)
  returned `kpis.revenue === 6500` and `kpis.orders === 3` — proving the
  single-day range edge case works, not just multi-day ranges.
- `GET /merchant/wallet` returned a numeric `availableBalance`.
- `GET /merchant/business` returned `200`/`ACTIVE` for the fixtured
  merchant, and `404` for a second fixtured merchant with no `Business`
  row yet — both of the page's real branches.
- `GET /merchant/notifications?unreadOnly=true&limit=1` returned
  `total === 1`, then `total === 0` after marking the notification read
  — proving `unreadOnly` is a real filter, not a coincidentally-correct
  total.
- `GET /merchant/reviews?page=1&pageSize=3` returned the review and a
  correct `aggregate.reviewCount === 1`.

Individual order-lifecycle mechanics (checkout → accept → ready →
delivery → settlement), cross-merchant isolation, and reviews/analytics
correctness were already deeply verified in DPX-MERCHANT-008/010/011 —
this pass's purpose was narrower and additive: confirm the _specific
composition_ Overview performs (simultaneous status counts, the
single-day analytics range, the unread-notification filter, both
Business branches) returns exactly what the page code expects.

## 4. Security review

No new endpoint, permission, or mutation was introduced — every data
source Overview reads is one of the same `merchant/*` endpoints already
covered by DPX-MERCHANT-012's authorization/isolation review
(`merchant/orders`, `merchant/analytics/overview`, `merchant/wallet`,
`merchant/business`, `merchant/notifications`, `merchant/reviews`), all
of which already require the authenticated merchant's own JWT and either
have no `:id` parameter at all (wallet, analytics, business, order-list,
review-list — no foreign-id injection surface exists) or were already
live-tested for cross-merchant IDOR resistance (orders, in
DPX-MERCHANT-012 §4). Overview adds a read-only composition on top; it
does not add a mutation path beyond the pre-existing "mark notification
read" call the E2E script exercised, which DPX-MERCHANT-012 §3 already
confirmed is ownership-scoped (`NotificationCenterService.
assertNotificationOwner()`). No new security surface exists to review.

## 5. Production audit

- **Module completeness**: task #381 is now genuinely done — the
  dashboard reflects Orders, Wallet, Notifications, Analytics, and Store
  Status, the five real capabilities DPX-MERCHANT-013 flagged as missing
  from the stale Phase 1 page.
- **SDK coverage**: zero new SDK methods added; the one pre-existing gap
  DPX-MERCHANT-013 found (`stock-status`) is unrelated to this screen and
  remains open, as recorded there.
- **Merchant Portal coverage**: no change to the gap inventory beyond
  closing #381 itself.
- **Documentation**: this document; DPX-MERCHANT-010's inaccurate
  "screen-by-screen build is complete" claim was already corrected in
  DPX-MERCHANT-013 §2.1 and remains the record of that correction.
- **Performance**: six independent, already-paginated/-indexed read
  queries fired in parallel via `Promise.allSettled` (not sequentially) —
  no N+1 pattern, no unbounded query, consistent with DPX-MERCHANT-013
  §6's performance findings for every other merchant list endpoint.
- **Error handling**: per-section `{data, error}` state with
  `Promise.allSettled` means one slow/failing call degrades only its own
  widget, never the page — confirmed by code review and implicitly by
  the 404-business-branch assertion in §3.
- **Production readiness**: no new deployment consideration — this
  screen ships inside the same `apps/merchant-portal` build as every
  other Phase 2 screen; DPX-MERCHANT-013's finding #3 (merchant-portal
  not yet in `docs/ops/PRODUCTION-RAILWAY.md`) still applies and is
  unchanged by this work.

## 6. Verification commands run

`tsc --noEmit`, `eslint --max-warnings=0`, and `next build` (including
static generation of the `/` route) all passed clean before the live
E2E pass above. No test suite regression — this is a frontend
composition change with no backend/SDK code touched.

## 7. Next step

Task #381 is complete. Return to the founder for Founder Review of the
full Merchant Phase 2 package (DPX-MERCHANT-011 E2E, -012 security,
-013 production audit, -014 this addendum) before requesting Merchant
module freeze.
