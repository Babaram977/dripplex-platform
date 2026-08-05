# DPX-COMMERCIAL-001 Slice 1 — Commercial Engine Foundation

## 1. Scope (per the locked policy doc's §0.1/§6 sequencing)

`docs/DPX-COMMERCIAL-001-REVENUE-SETTLEMENT-CREDIT-POLICY.md` locked the
full commercial policy and its 6-slice execution plan, explicitly deferred
until Merchant Phase 2 reached production audit and freeze. With
DPX-MERCHANT-001 now 🔒 Approved & Frozen, the founder confirmed the
locked sequence resumes: "DPX-COMMERCIAL-001 — implement the shared
commercial engine (commission accounts, credit limits, settlement,
blocking/unblocking, admin recording, automatic deduction), since it spans
both Marketplace and Ride."

Slice 1, per §6, is deliberately **additive-only — no behavior change to
anything that already ships**:

- `CommissionAccount` + `CommissionLedgerEntry` schema
- `CommercialCreditSettingsService` (admin-configurable credit limits,
  `DEFAULT_MERCHANT_CREDIT_LIMIT`/`DEFAULT_DRIVER_CREDIT_LIMIT` seed
  constants only)
- Admin-manual payment recording
- Audit actions, tests

No real accrual call site is wired in this slice. `CommissionAccount`
rows only exist once something calls `accrue()` — nothing in the existing
checkout, order-lifecycle, or ride-payment code paths does yet. That
wiring is Slices 2-4, each requiring its own explicit pass per §6's plan
(Marketplace mode B "Pay to Merchant", fixing Marketplace Cash on
Delivery's settlement direction — a behavior change to already-shipped
code flagged for separate sign-off — and Ride cash).

## 2. Schema

Two migrations, both additive (`prisma migrate diff` against the live dev
database, isolated from unrelated pre-existing drift rather than blindly
applying a full diff):

- `20260805090000_dpx_commercial_001_commission_accounts` — the three new
  tables (`commission_accounts`, `commission_ledger_entries`,
  `commercial_credit_settings`) and two new enums (`CommissionOwnerType`:
  `MERCHANT`/`DRIVER`/`RIDER`, mirroring `WalletOwnerType`'s existing
  split; `CommissionEntryType`: `ACCRUAL`/`PAYMENT`/`ADJUSTMENT`).
- `20260805090100_dpx_commercial_001_account_version` — an optimistic-
  concurrency `version` column on `CommissionAccount`, added after
  reviewing `Wallet.version`'s precedent and deciding a liability balance
  needs the same conditional-update guard an asset balance already gets.

`CommissionAccount` is the liability side, deliberately separate from
`Wallet` (which hard-blocks going negative) — one row per
`(ownerType, ownerId)`, `outstandingBalance` what they owe DrippleX,
`creditLimit` a per-account snapshot of the currently-effective global
setting (re-synced whenever `accrue()`/`recordPayment()` runs, so a
policy change is prospective, matching how `OrderSettlement.commissionRate`
snapshots rather than retroactively recalculating). `CommissionLedgerEntry`
mirrors `WalletLedgerEntry`'s shape, including the
`(accountId, referenceType, referenceId)` unique index that gives
reference-tied entries an exactly-once guard.

## 3. Services

- **`CommercialCreditSettingsService`** — `getEffective(ownerType)`/
  `update(ownerType, creditLimit, adminUserId, context)`, one row per
  owner type (not per account), get-or-create-singleton-per-key pattern
  identical to `MerchantCommissionSettingsService`/
  `DriverSecuritySettingsService`. `DRIVER` and `RIDER` share
  `DEFAULT_DRIVER_CREDIT_LIMIT` (the policy doc names only two default
  constants, treating "Driver/Rider" as one credit-policy concept in
  §1.3), `MERCHANT` uses its own constant. Both default to ₦10,000 per
  the founder's locked policy.
- **`CommissionAccountService`** — `getOrCreateAccount()`, `accrue()`,
  `recordPayment()`, `listLedgerEntries()`. Mirrors
  `WalletService.applyMutation()`'s proven shape: exactly-once via a
  reference pre-check inside the transaction, optimistic-concurrency
  conditional `updateMany()` on `(id, version)`, a ledger entry recording
  the balance transition. `recomputeAndPersistBlockState()` runs after
  every accrue/payment — re-reads the effective limit, re-syncs it onto
  the account, recomputes `blocked = outstandingBalance > creditLimit`,
  and audit-logs a state transition (not every call — only when `blocked`
  actually flips).

## 4. Admin endpoints

- `GET/PATCH /admin/commercial/credit-settings/:ownerType` (`PATCH` body
  `{ownerType, creditLimit}`) — new permission
  `admin:commercial:credit-settings:manage`.
- `GET /admin/commercial/accounts/:ownerType/:ownerId` — account read
  (get-or-create; a fresh account genuinely has zero balance, this is not
  a fabricated placeholder).
- `GET /admin/commercial/accounts/:ownerType/:ownerId/ledger` — paginated
  ledger history.
- `POST /admin/commercial/accounts/:ownerType/:ownerId/payments` —
  admin-manual payment recording, §0.2's second pay-down mechanism
  (automatic deduction from a mode-A settlement is Slice 2+, not exposed
  here since no mode-A/B/C accrual exists yet to deduct against). New
  permission `admin:commercial:account:manage`.

Both permissions granted to `administrator`/`super_administrator` only,
same tier as the DPX-MERCHANT-002 commission-rate permission and
Driver-001's security-settings permission — editing commercial/financial
policy is more sensitive than routine admin work.

## 5. SDK + shared types

`packages/types/src/commercial/index.ts` (`CommissionAccountDto`,
`CommissionLedgerEntryDto`, `CommercialCreditSettingDto`,
`CommissionOwnerType`, `CommissionEntryType`, request DTOs, audit action
constants) and two new SDK clients
(`AdminCommercialCreditSettingsClient`, `AdminCommissionAccountsClient`),
wired into `DripplexClient` as `adminCommercialCreditSettings`/
`adminCommissionAccounts`. No merchant-portal/driver-portal/admin-portal
UI built yet — Slice 1 is backend+SDK only, per §6; the frontend surfacing
described in the policy doc's §4 is Slice 5.

## 6. Tests

Two real-database spec files (same methodology as
`driver-security-settings.service.spec.ts` — a live Postgres connection,
not mocks), **15/15 passing**:

- `commercial-credit-settings.service.spec.ts` (8 tests): default seeding
  per owner type, MERCHANT/DRIVER independence, update + audit trail,
  seed-on-first-update.
- `commission-account.service.spec.ts` (7 tests): account creation seeded
  from the effective limit, accrual + ledger entry, exactly-once replay,
  blocking past the limit (+ audit), payment reducing balance and
  unblocking (+ audit), payment exceeding balance rejected, non-positive
  amount rejected, cross-owner isolation.

## 7. Full verification

- `tsc --noEmit`: clean.
- `eslint src --max-warnings=0` (whole backend, not just the new module):
  clean.
- `pnpm --filter @dripplex/types build` / `pnpm --filter @dripplex/sdk
build`: clean.
- `jest --runInBand` (full suite): **1275/1278** passing. The one
  regression this slice caused (`prisma-foundation.spec.ts`'s hardcoded
  permission-catalog-size assertion, 107→109 for the two new permissions)
  was fixed in the same commit. The remaining 3 failures are pre-existing
  and unrelated to this work — confirmed via `git status` that this
  session touched no `operations/` or `products/` files:
  - `operations-cases.service.spec.ts`: one test's own fixture inserts a
    `SosAlert` row with a random `vehicleId` that has no matching
    `Vehicle` row in the dev database, violating the FK constraint — a
    dev-database fixture-drift issue, not this session's code.
  - `customer-products.service.spec.ts` (2 tests): the same "extra seeded
    product row from an earlier session" fixture-count drift already
    diagnosed and documented in DPX-MERCHANT-002's own verification
    round.

## 8. What Slice 1 deliberately does not do

- No real accrual call site — Marketplace mode B/C and Ride cash still
  behave exactly as before (mode C's known accounting-direction defect,
  §2.1 of the policy doc, is untouched — fixing it is Slice 3, flagged
  there for separate founder sign-off since it changes shipped behavior).
- No frontend UI.
- No automatic-deduction wiring (needs a real mode-A settlement path to
  deduct from, which Slice 2 builds).
- No per-account credit-limit override — only the per-owner-type global
  setting the policy doc actually asked for.

## 9. Next step

Slice 2 (Marketplace mode B — "Pay to Merchant"): new
`OrderPaymentMethod` value, checkout wiring, commission-owed accrual,
merchant blocking at checkout, automatic-deduction wiring for any
merchant with an outstanding balance who also earns a mode-A settlement.
