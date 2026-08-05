# DPX-COMMERCIAL-001 Slice 5 — Commercial Visibility

## 1. Scope (per the founder's locked instruction)

Founder authorization, recorded verbatim:

> The scope should remain focused on surfacing the commercial engine
> that now exists, not changing its behavior.
>
> Merchant: outstanding commission, credit limit, available credit,
> commercial ledger/history, commission status, blocked warning (where
> applicable).
>
> Driver: outstanding commission, credit limit, available credit,
> commercial ledger/history, blocked warning, settlement history.
>
> Admin: commercial dashboard, merchant commission accounts, driver
> commission accounts, outstanding balances, manual payment recording,
> credit-limit monitoring.
>
> Rules: no redesign of Merchant Portal, Driver Portal, or Admin Portal.
> Continue using the approved DDS and do not modify Figma-locked shared
> components. Compose the new views using existing design patterns.
> Reuse existing backend and SDK surfaces wherever possible. Only add
> backend APIs if the current commercial engine genuinely lacks read
> endpoints.

Slice 5 is a pure read/UI slice: **no accrual, blocking, or ledger logic
changes**. Every number surfaced already existed in `CommissionAccount`
and `CommissionLedgerEntry` since Slice 1, populated by real call sites
since Slices 2-4.

## 2. Research findings (before writing any code)

- **Admin read endpoints already existed** (Slice 1, unchanged):
  `AdminCommissionAccountsController`
  (`GET /admin/commercial/accounts/:ownerType/:ownerId`, `.../ledger`,
  `POST .../payments`) and `AdminCommercialCreditSettingsController`
  (`GET/PATCH /admin/commercial/credit-settings/:ownerType`). These
  cover the entire Admin scope — no new admin backend endpoint needed.
- **Genuinely missing**: no merchant-self or driver-self read endpoint
  existed for their own `CommissionAccount`/ledger — only the
  admin-scoped endpoints. This satisfied the founder's explicit
  condition for adding new backend APIs. Closed in §3.
- **SDK gap unrelated to endpoints**: `sdk-admin.ts` never exposed the
  Slice-1 admin commercial clients at all (`adminCommercialCreditSettings`,
  `adminCommissionAccounts` existed on `DripplexClient` but weren't
  wired into the Admin Portal's barrel) — a pure SDK-wiring gap, not a
  missing backend endpoint. Closed in §3.
- **`AdminDriversClient` had zero list/detail coverage** of the
  already-existing `GET /admin/drivers` / `GET /admin/driver/:id`
  backend endpoints — needed for the Admin Portal's driver picker.
  Closed in §3 (SDK-only; the backend endpoints already existed).
- **`CommissionAccountDto`/`CommissionLedgerEntryDto`** (unchanged since
  Slice 1) already carry every field this slice's UI needs.
  `availableCredit` is a client-derived value (`creditLimit −
outstandingBalance`), not a stored field — deliberately, so it can
  never drift out of sync with the two fields it's computed from (see
  the reconciliation doc, §4.3).
- **Merchant's `MerchantProfileDto.merchantId` and Driver's
  `DriverProfileDto.driverId`** are both `User.id`, not the surrounding
  profile's own id — the correct value for `CommissionAccount.ownerId`,
  confirmed against `merchant.mapper.ts` / `driver.mapper.ts` and the
  exact `merchantUserId` resolve pattern `MerchantSettlementService`
  already uses.
- **`apps/admin-portal` was a near-empty skeleton** (home page +
  login only, no nav shell) — the only app of the three needing
  genuinely new scaffolding (an `AppShell`), built by mirroring
  `operations-console`'s already-approved `AppShell` structure exactly
  (same nav-link/logout pattern), not inventing a new one.

## 3. Backend: self-read endpoints (merchant + driver)

New, mirroring `MerchantWalletController`/`DriverWalletController`'s
exact self-read shape (`@CurrentUser() user`, `user.id` passed straight
through as `ownerId`, no resolve step — same as Slice 4's driver
call site):

- `MerchantCommercialController` — `GET /merchant/commercial/account`,
  `GET /merchant/commercial/ledger` (paginated).
- `DriverCommercialController` — `GET /driver/commercial/account`,
  `GET /driver/commercial/ledger` (paginated).

Both call straight into the existing `CommissionAccountService`
(`getOrCreateAccount()` / `listLedgerEntries()`) — the identical methods
`AdminCommissionAccountsController` already used. No new service logic.

New permissions, mirroring `WALLET_PERMISSIONS.MERCHANT_READ`/
`DRIVER_READ` exactly: `COMMERCIAL_PERMISSIONS.MERCHANT_READ =
'merchant:commercial:read'`, `DRIVER_READ = 'driver:commercial:read'`.
Registered in `seed-data/permissions.ts`, granted to the `merchant` role
(alongside `merchant:wallet:read`), the `driver` role (alongside
`driver:wallet:read`), and `super_administrator` (alongside both wallet
reads) in `seed-data/role-permissions.ts` — the exact same three grant
sites the wallet-read permissions use.

## 4. SDK

- `MerchantCommercialClient` / `DriverCommercialClient`
  (`packages/sdk/src/commercial/`) — thin wrappers over the two new
  endpoints, matching `AdminCommissionAccountsClient`'s existing shape.
  Wired into `DripplexClient` and exposed as `commercial` on
  `MerchantSdk`/`DriverSdk`.
- `sdk-admin.ts` — now exposes `adminCommercialCreditSettings` and
  `adminCommissionAccounts` (existed on `DripplexClient` since Slice 1,
  never wired into the Admin Portal's barrel until this slice — a pure
  wiring gap, not new capability).
- `AdminDriversClient` — added `listDrivers()` / `getDriver()`,
  mirroring `AdminMerchantsApi.listMerchants()`/`getMerchant()` exactly.
  The backend endpoints (`GET /admin/drivers`, `GET /admin/driver/:id`)
  already existed from `AdminDriversController`; this closes a
  documented pre-existing SDK-coverage gap for the admin driver picker.
  The rest of `AdminDriversController`'s approve/reject/suspend/
  reactivate endpoints remain undocumented SDK gaps, unrelated to this
  slice.

## 5. Merchant Portal

Extended the existing Wallet & Bank page (DPX-MERCHANT-007) — the
founder's own framing for where commission visibility belongs, since
that page already shows the merchant's settlement breakdown including
commission per order. Two new cards, inserted alongside the existing
Balance/Settlements/Ledger/Bank-account cards, same visual pattern:

- **"Commission owed"** — outstanding commission, credit limit,
  available credit, status badge (Clear / Outstanding / Blocked), and a
  blocked-warning banner when applicable.
- **"Commission ledger"** — paginated accrual/payment history, same
  table shape as the existing Wallet ledger card.

No new page, no nav change, no Figma-locked component touched.

## 6. Driver Portal

Extended the existing Earnings page (Launch Mode Slice 4) — added a new
`CommercialPanel` component (mirroring the existing `WalletPanel`'s
exact shape: balance-summary card + history card) right below the
existing wallet panel:

- **"Platform fee owed"** — outstanding commission, credit limit,
  available credit, status badge, blocked-warning banner (explicitly
  naming the "cannot go Online" consequence from Slice 4).
- **"Settlement history"** — paginated accrual/payment history.

No new page, no nav change, no Figma-locked component touched.

## 7. Admin Portal

The only portal needing new scaffolding, since `apps/admin-portal` had
no nav shell at all before this slice.

- **`AppShell`** — new, structurally mirrors `operations-console`'s
  already-approved `AppShell` (same header/nav/logout pattern), scoped
  to the two real screens that exist in this app today (Home,
  Commercial) — no disabled-link placeholders for screens that don't
  exist yet, the same discipline `operations-console`'s own `AppShell`
  comment documents.
- **`/commercial` page** — three sections:
  1. **Credit-limit monitoring** — the admin-configurable
     Merchant/Driver credit limits (`AdminCommercialCreditSettingsController`,
     Slice 1), inline-editable.
  2. **Commission accounts** — a Merchant/Driver toggle, a picker
     populated from `AdminMerchantsApi.listMerchants()` /
     `AdminDriversClient.listDrivers()` (both pre-existing list
     endpoints, first 100 results, no new "list all commission
     accounts" endpoint needed), and on selection: outstanding balance,
     credit limit, available credit, status, blocked warning, paginated
     ledger, and a manual-payment form
     (`AdminCommissionAccountsController.recordPayment()`, Slice 1).

Existing `page.tsx` (backend status panel) now renders inside the same
`AppShell` for a consistent nav — the only change to a pre-existing
screen, and it's additive (a nav header), not a redesign.

## 8. Commercial Reconciliation Verification

Per the founder's explicit additional instruction for this slice, see
`docs/DPX-COMMERCIAL-001-SLICE-5-COMMERCIAL-RECONCILIATION.md` — a new
real-Postgres test proving, for a representative Merchant scenario and a
representative Driver scenario, that commission accrued, commission
paid, outstanding balance, available credit, and blocked/unblocked
status all reconcile exactly against the Commission Ledger and
Commission Account.

## 9. Security review

- **Self-scoping, not client-supplied.** `MerchantCommercialController`
  and `DriverCommercialController` always resolve `ownerId` from
  `@CurrentUser()`, never from a URL param or request body — a merchant
  or driver cannot pass another owner's id to read their account. No
  IDOR surface introduced.
- **Permission-gated.** All four new/newly-exposed read paths
  (`merchant:commercial:read`, `driver:commercial:read` on the two new
  controllers; the pre-existing `admin:commercial:account:manage` /
  `admin:commercial:credit-settings:manage` on the now-SDK-wired admin
  clients) are enforced by `@RequirePermissions` guards, same mechanism
  as every other endpoint in this codebase — no new guard logic written.
- **Admin write paths unchanged.** The Admin Portal's manual-payment
  form and credit-limit editor call the exact same
  `recordPayment()`/`update()` methods and DTOs
  (`RecordCommissionPaymentDto`, `UpdateCommercialCreditSettingDto`)
  that existed and were reviewed in Slice 1 — no new server-side
  validation surface.
- **Pagination bounded.** Both new self-read ledger endpoints cap
  `pageSize` at 100 (`Math.min(100, ...)`), identical to the existing
  admin ledger endpoint — no unbounded-query risk introduced.
- **List endpoints used for the Admin Portal's picker**
  (`AdminMerchantsApi.listMerchants()`, `AdminDriversClient.listDrivers()`)
  are gated by their own existing admin permissions
  (`admin:merchants:review`, `driver:review` respectively) — unrelated
  to and independent of the commercial permission, so an admin without
  merchant/driver-review access simply can't populate the picker, a
  stricter outcome, not a weaker one.
- No new database queries, no new raw SQL, no new external I/O — every
  new controller is a thin pass-through to already-tested
  `CommissionAccountService` methods.

## 10. Verification

- **Backend**: `tsc --noEmit` clean, `eslint src --max-warnings=0`
  clean, full `jest --runInBand` suite: **170/170 test suites, 1305/1305
  tests passing** — including the new
  `commercial-reconciliation.e2e.spec.ts` (2/2, §8). Unlike every prior
  slice's verification round, this run reports zero pre-existing
  failures (the `operations-cases.service.spec.ts`/
  `customer-products.service.spec.ts` fixture-drift issues noted in
  Slices 2-4's docs are not present in this run — apparently resolved
  elsewhere between slices, not something this slice touched or fixed).
- **SDK package**: `tsc --noEmit` clean, `eslint --max-warnings=0`
  clean, `vitest run` — 33 test files, 152/152 passing.
- **Merchant Portal**: `tsc --noEmit` clean, `eslint --max-warnings=0`
  clean, `vitest run` — 1/1 passing (`sdk-isolation.spec.ts`).
- **Driver Portal**: `tsc --noEmit` clean, `eslint --max-warnings=0`
  clean, `vitest run` — 4/4 passing.
- **Admin Portal**: `tsc --noEmit` clean, `eslint --max-warnings=0`
  clean, `vitest run` — 1/1 passing, **and** `next build` — production
  build succeeds, `/commercial` route statically generated alongside
  `/`, `/login`.

## 11. Production audit

- **No schema/migration risk** — Slice 5 is UI/API-surface only; no
  Prisma schema change, no migration to run.
- **No new database load pattern** — every new read is a single
  `getOrCreateAccount()` or paginated `listLedgerEntries()` call, both
  already indexed and load-tested by Slice 1-4's own concurrency/volume
  work; the Admin Portal's picker fetches at most 100 rows once per
  owner-type toggle, not on every keystroke.
- **No polling added** — all three portals' new cards fetch on mount
  only (Merchant/Driver Portal) or on selection (Admin Portal); no new
  interval timers introduced (the Merchant Portal wallet page's
  existing 15s poll, which now also covers the new commission card via
  its own independent effect, was not created by this slice).
- **Environment parity** — no new environment variables, no new
  external service dependency; the Admin Portal's `next build` uses the
  same build pipeline (`open-next`/Cloudflare) as its existing routes.
- **Rollback is trivial** — every change in this slice is additive
  (new controllers, new SDK methods, new UI cards/page); reverting the
  commit set restores the pre-Slice-5 state with no data migration to
  undo, since no schema changed.

## 12. What Slice 5 deliberately does not do

- Does not change any accrual, blocking, or payment logic — every write
  path this slice's UI triggers is the same `recordPayment()`/
  `update()` (credit settings) admin action that existed since Slice 1.
- Does not add a "list all commission accounts" backend endpoint — the
  Admin Portal composes existing merchant/driver list endpoints with
  the existing per-owner account endpoint instead.
- Does not redesign any portal's navigation, layout system, or
  Figma-locked shared components — Merchant/Driver Portal changes are
  additive cards on existing pages; Admin Portal's `AppShell` mirrors
  an already-approved structural pattern rather than inventing one.
- Does not close the pre-existing SDK gaps this research surfaced that
  are unrelated to commercial visibility (the rest of
  `AdminDriversController`'s approve/reject/suspend/reactivate
  endpoints) — flagged honestly, not silently expanded into scope.

## 13. ✅ Founder Review — Approved (2026-08-05)

> DPX-COMMERCIAL-001 Slice 5. Status: ✅ Approved. This is exactly the
> slice I expected after the commercial engine was completed. Rather
> than introducing new financial behavior, it exposes the existing
> commercial state to the right users in a consistent, auditable way...
> [Merchant Commercial Visibility, Driver Commercial Visibility, Admin
> Commercial Console, Backend & SDK — each individually approved]...
> Commercial Reconciliation Verification — this is the most important
> deliverable in this slice... That should remain a permanent
> verification artifact... Figma/DDS Compliance — that satisfies the
> project's Figma Protection Rule.

## 14. Next step — Slice 6 (the completion slice)

Founder-authorized, not another feature slice — full detail and locked
scope recorded in
`docs/DPX-COMMERCIAL-001-REVENUE-SETTLEMENT-CREDIT-POLICY.md` §7 and
tracked in `docs/DPX-COMMERCIAL-001-SLICE-6-COMPLETION.md`:

- End-to-end verification of every commercial payment path (Marketplace
  Mode A/B/Cash, Ride Cash), merchant/driver blocking-unblocking,
  manual payment recording, automatic deduction, ledger integrity,
  credit-limit behavior.
- Security review (authorization, permission boundaries, commercial
  data isolation, commercial endpoints, audit logging,
  replay/idempotency).
- Production audit, matching the Wallet/Driver/Operations/Merchant
  audits' format.
- Documentation updates (this policy doc, Production Audit, Reality
  Audit, Release History, Module Completion Gate).
- A **Platform Commercial Readiness Matrix** — the definitive
  launch-readiness reference for the commercial engine.
- Return for founder review — Slice 6 does not freeze
  DPX-COMMERCIAL-001 automatically.
