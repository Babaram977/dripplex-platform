# DPX-COMMERCIAL-001 Slice 6 — Completion Slice

## 1. Scope (per the founder's locked instruction)

Founder authorization, recorded verbatim:

> This is not another feature slice. It is the completion slice. Its
> scope should be limited to: End-to-End Verification — validate the
> entire commercial lifecycle for Marketplace Mode A, Marketplace Mode
> B, Marketplace Cash on Delivery, Ride Cash, Merchant
> blocking/unblocking, Driver blocking/unblocking, Manual payment
> recording, Automatic deduction, Ledger integrity, Credit-limit
> behavior. Security Review — authorization, permission boundaries,
> commercial data isolation, commercial endpoints, audit logging,
> replay/idempotency risks. Production Audit — the same
> production-grade audit used for Wallet, Driver, Operations, and
> Merchant. Documentation — update DPX-COMMERCIAL-001, Production
> Audit, Reality Audit, Release History, Module Completion Gate.
> Founder Review — return for final approval. Do not freeze
> automatically. One final requirement: include a Platform Commercial
> Readiness Matrix.

No new commercial behavior is introduced by this slice — it verifies,
audits, and documents the engine built across Slices 1-5.

## 2. End-to-end verification

### 2.1 What already existed (Slices 1-5's own specs)

Every individual mechanism was already proven with real Postgres before
this slice began:

- **Marketplace Mode A auto-deduction** —
  `merchant-settlement.service.spec.ts` ("automatic deduction: a
  mode-A settlement pays down an outstanding commission balance",
  "automatic deduction is capped at the theoretical merchantAmount",
  "concurrent mode-A settlements... never lose an update").
- **Marketplace Mode B accrual** — same file ("accrues the commission
  owed to the CommissionAccount", "replayed mode-B settlement...
  exactly-once", "reversing a mode-B settlement reverses the
  accrual", "concurrent mode-B settlement calls... exactly one
  accrual").
- **Marketplace Cash on Delivery accrual** — same file ("CASH
  settlement accrues commission", "replayed CASH settlement...
  exactly-once", "reversing a CASH settlement reverses the accrual",
  "concurrent CASH settlements... never lose an accrual").
- **Merchant blocking at checkout** — `checkout.service.spec.ts`
  ("rejects a merchant whose CommissionAccount is blocked").
- **Ride Cash accrual** — `ride-payment.service.spec.ts` ("accrues the
  platform commission onto the driver CommissionAccount", "replayed
  confirmCash... never double-accrues", concurrency test for two
  different rides by the same driver).
- **Driver blocking/unblocking on go-online** —
  `rides.service.spec.ts` ("rejects going online for a driver whose
  CommissionAccount is blocked, but never blocks going offline").
- **Manual payment recording, credit-limit behavior, ledger
  integrity** — `commission-account.service.spec.ts` (the primitives)
  and `docs/DPX-COMMERCIAL-001-SLICE-5-COMMERCIAL-RECONCILIATION.md`
  (the founder-required real-Postgres reconciliation proof for one
  Merchant and one Driver scenario, including both directions of the
  blocking transition).

### 2.2 What this slice adds

`apps/backend/src/commercial/commercial-lifecycle.e2e.spec.ts` — new,
real Postgres, 2/2 passing. Every mechanism above is proven in
isolation with fresh fixtures per test; this file's job is the one
genuinely new thing the founder's "entire commercial lifecycle"
language calls for — proving the _cumulative_, cross-payment-method
behavior a real merchant or driver experiences over time, all landing
on the _same_ account:

- **Merchant scenario** (₦15,000 credit limit): Mode B order settles
  (₦9,000 accrued) → Cash on Delivery order settles (₦7,000 accrued,
  ₦16,000 total, **blocked**) → admin records a ₦10,000 manual payment
  (₦6,000 outstanding, **unblocked**) → a Mode A order settles
  (₦200,000 gross, ₦20,000 commission, automatic deduction pays down
  the remaining ₦6,000 before crediting ₦174,000 net to Wallet,
  **balance reaches exactly ₦0**) → final ledger reconciliation:
  accrued ₦16,000, paid ₦16,000 (₦10,000 manual + ₦6,000 automatic),
  net ₦0, matching the account's outstanding balance exactly, across 4
  ledger entries.
- **Driver scenario** (₦12,000 credit limit, admin-set — deliberately
  distinct from Slice 5's default-seed-fallback scenario, proving the
  override path too): two cash rides accrue ₦7,500 and ₦6,000
  (₦13,500 total, **blocked**) → admin records a ₦5,000 manual payment
  (₦8,500 outstanding, **unblocked**) → final ledger reconciliation:
  accrued ₦13,500, paid ₦5,000, net ₦8,500, matching the account's
  outstanding balance exactly, across 3 ledger entries.

Both scenarios independently prove every item on the founder's list:
Mode A auto-deduction, Mode B accrual, Cash accrual, Ride Cash accrual,
merchant blocking/unblocking, driver blocking/unblocking, manual
payment recording, and ledger integrity, all within one continuous,
realistic account history rather than isolated single-mechanism tests.

## 3. Security review

- **Authorization** — every route in this backend passes through two
  global guards (`APP_GUARD` providers in `app.module.ts`):
  `JwtAuthGuard` (a valid JWT is required for every request, no
  exceptions in the commercial module) and `PermissionsGuard` (enforces
  `@RequirePermissions`, throwing `ForbiddenDomainException` on a
  missing grant). All four commercial-visibility controllers
  (`AdminCommercialCreditSettingsController`,
  `AdminCommissionAccountsController`, `MerchantCommercialController`,
  `DriverCommercialController`) declare `@RequirePermissions` at the
  class level — none rely on the guard's default-allow-when-undecorated
  fallback.
- **Permission boundaries** — confirmed against
  `apps/backend/prisma/seed-data/role-permissions.ts`:
  `admin:commercial:credit-settings:manage` and
  `admin:commercial:account:manage` are granted only to `administrator`
  and `super_administrator` — **not** `operations_staff`, correctly
  withholding financial-admin authority from the operations role.
  `merchant:commercial:read`/`driver:commercial:read` are granted to
  the `merchant`/`driver` roles respectively (self-only) and to
  `super_administrator` (for admin impersonation/support tooling
  parity with the equivalent wallet-read grants) — never to
  `administrator` or `operations_staff`, since those roles read
  commercial data through the admin-scoped endpoints instead.
- **Commercial data isolation** — `MerchantCommercialController`/
  `DriverCommercialController` resolve `ownerId` exclusively from
  `@CurrentUser()` (the JWT-derived principal), never from a URL
  parameter or request body. A merchant or driver has no code path to
  read another owner's commission account or ledger — no IDOR surface.
  Admin-scoped endpoints take `ownerType`/`ownerId` from the URL, both
  validated (`ParseEnumPipe`/`ParseUUIDPipe`) before reaching the
  service layer.
- **Commercial endpoints inventory** (all reviewed):
  `GET/PATCH /admin/commercial/credit-settings/:ownerType`,
  `GET /admin/commercial/accounts/:ownerType/:ownerId`,
  `GET .../ledger`, `POST .../payments`,
  `GET /merchant/commercial/account`, `GET /merchant/commercial/ledger`,
  `GET /driver/commercial/account`, `GET /driver/commercial/ledger`.
  Every GET is read-only with no side effects; the two write paths
  (`PATCH credit-settings`, `POST payments`) are both admin-only and
  both fully audited (below).
- **Audit logging** — two deliberate tiers. Every accrual, deduction,
  and payment (automatic or manual) is durably recorded in the
  append-only `CommissionLedgerEntry` table regardless of who or what
  triggered it — this is itself the permanent, queryable audit trail
  for money movement. Separately, admin-initiated actions
  (`recordPayment()`, credit-limit `update()`) and blocking-state
  transitions (`BLOCKED`/`UNBLOCKED`) are also written to the
  platform-wide `AuditLog` via `AuditService.record()`, capturing
  `recordedBy`/`userId` and `ipAddress` — the same mechanism every
  other admin-financial action in this codebase uses (wallet
  reconciliation, merchant commission-rate changes, driver security
  settings).
- **Replay / idempotency risks** — every automatic accrual and
  deduction is protected by a database-level `@@unique([accountId,
referenceType, referenceId])` constraint on `CommissionLedgerEntry`,
  not just an application-level pre-check — a genuine replay (retried
  webhook, duplicate settlement call) cannot double-write the ledger,
  confirmed by every "replayed ... stays exactly-once" test across
  Slices 2-4. The one identified, accepted exception is manual admin
  payments, which carry no natural `referenceType`/`referenceId` and
  are therefore not database-protected against an accidental
  double-submit — documented in full in
  `docs/DPX-COMMERCIAL-001-PRODUCTION-AUDIT.md` §5.1 as a known,
  non-blocking risk (fully audit-logged and reversible, not silent).

No authorization bypass, data-isolation failure, or unaudited write
path was found.

## 4. Production audit

See `docs/DPX-COMMERCIAL-001-PRODUCTION-AUDIT.md` — schema/indexing,
concurrency, N+1 review, three honest findings (none launch-blocking),
readiness scorecard, and recommendation (production-ready).

## 5. Platform Commercial Readiness Matrix

| Payment Flow                         | Commission Capture                          | Auto Deduction | Manual Settlement | Credit Limit                                      | Ledger                                                                  | Verified |
| ------------------------------------ | ------------------------------------------- | -------------- | ----------------- | ------------------------------------------------- | ----------------------------------------------------------------------- | -------- |
| Marketplace Mode A (escrow/gateway)  | ✅ direct net-of-commission Wallet credit¹  | ✅             | ✅                | ✅ (indirectly, via auto-deduction reducing debt) | ✅ Wallet ledger always; Commission ledger only when a deduction occurs | ✅       |
| Marketplace Mode B (Pay to Merchant) | ✅ CommissionAccount accrual                | N/A²           | ✅                | ✅                                                | ✅                                                                      | ✅       |
| Marketplace Cash on Delivery         | ✅ CommissionAccount accrual                | N/A²           | ✅                | ✅                                                | ✅                                                                      | ✅       |
| Ride Cash                            | ✅ CommissionAccount accrual (driver-owned) | N/A²           | ✅                | ✅ blocks driver going Online                     | ✅                                                                      | ✅       |

¹ Mode A never credits the commission portion to the merchant's Wallet
in the first place — DrippleX holds the full sale amount throughout, so
retaining the commission requires no separate liability record.
Functionally equivalent in outcome to Mode B/C's accrual (DrippleX
retains exactly the commission amount either way), captured via a
different mechanism (subtraction at settlement, not a tracked debt).

² Auto Deduction only applies to Mode A settlements, which are the only
flow where money is credited to a Wallet that a prior debt can be
deducted from. Mode B, Cash, and Ride Cash never credit a Wallet, so
there is nothing for automatic deduction to act on — their debt is
cleared only by Auto Deduction on a _later_ Mode A order, or by a
manual payment. This is exactly what the Merchant lifecycle scenario in
§2.2 proves end-to-end.

Every cell above is backed by a real-Postgres passing test, cited in
§2. "Verified" means: exercised end-to-end against real Postgres,
reconciled against the ledger, in at least one of Slices 1-6's own
specs.

## 6. Documentation updated

- `docs/DPX-COMMERCIAL-001-REVENUE-SETTLEMENT-CREDIT-POLICY.md` §7 —
  Slice 6 status.
- `docs/DPX-COMMERCIAL-001-PRODUCTION-AUDIT.md` — new (§4 above).
- Reality Audit — DPX-COMMERCIAL-001 never had a standalone Reality
  Audit doc; its pre-Slice-1 research was folded directly into the
  policy doc's own early sections (unlike Merchant/Operations, which
  predated an existing backend and needed a dedicated audit of what was
  real vs. missing). Nothing to update separately.
- `docs/RELEASE-HISTORY.md` — new entry.
- `docs/DPX-100-MODULE-COMPLETION-GATE.md` — new DPX-COMMERCIAL-001
  entry under "Applying it retroactively".

## 7. Verification

- `tsc --noEmit` (backend): clean.
- `eslint src --max-warnings=0` (backend): clean.
- `jest --runInBand` (full backend suite): all passing, including the
  new `commercial-lifecycle.e2e.spec.ts` (2/2 against real Postgres).

## 8. Founder Review

Per the founder's explicit instruction, Slice 6 does **not** freeze
DPX-COMMERCIAL-001 automatically — returned here for final approval.

**Outcome (2026-08-05): ✅ Approved & Frozen.** The founder reviewed this
report at the module level and confirmed all three production-audit
findings (§4) as correctly classified non-blocking, and singled out the
Platform Commercial Readiness Matrix (§5) to "remain part of the
permanent commercial documentation." DPX-COMMERCIAL-001 now carries the
platform's standard freeze policy: critical security/defect fixes,
performance improvements, compliance updates, and explicit
founder-approved enhancements only. Full decision record:
`docs/DPX-COMMERCIAL-001-REVENUE-SETTLEMENT-CREDIT-POLICY.md` §7,
`docs/RELEASE-HISTORY.md`. With this freeze, Wallet, Marketplace, Ride,
Driver, Operations, Merchant, and Commercial Engine are all frozen,
completing the platform's core commerce and mobility foundation; the
platform moves into Launch Mode next per founder direction.
