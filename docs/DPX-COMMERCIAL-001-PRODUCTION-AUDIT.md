# DPX-COMMERCIAL-001 — Production Audit

**Status: 🔒 Founder Approved & Frozen (2026-08-05).** The founder
reviewed this audit's three findings (§5) and confirmed all three
non-blocking: manual-payment idempotency, no per-account credit override,
no blocking-transition alerting. None require closure before freeze; all
are carried forward as candidates for a future, explicitly-scoped
enhancement. See `docs/DPX-COMMERCIAL-001-REVENUE-SETTLEMENT-CREDIT-POLICY.md`
§7 for the full founder decision record.

Founder-required deliverable for Slice 6 (the completion slice), matching
the same production-grade audit format used for Wallet
(`docs/WALLET-DPX-100-PRODUCTION-AUDIT.md`), Driver
(`docs/DRIVER-SLICE-2-PRODUCTION-AUDIT.md`), Operations
(`docs/DPX-OPS-001-MODULE-PRODUCTION-AUDIT.md`), and Merchant
(`docs/DPX-MERCHANT-013-PRODUCTION-AUDIT.md`).

## 1. Scope

The whole DPX-COMMERCIAL-001 commercial engine across all six slices:
schema (Slice 1), Marketplace mode B accrual (Slice 2), Marketplace
mode C/COD correction (Slice 3), Ride cash correction (Slice 4),
commercial visibility across all three portals (Slice 5), and this
completion slice's E2E verification/security review/documentation
(Slice 6).

## 2. Schema & indexing

`CommissionAccount` — `@@unique([ownerType, ownerId])` (the exactly-once
account-per-owner guarantee every service method relies on),
`@@index([ownerType])`, `@@index([blocked])` (the blocked-status filter
the Admin Portal's dashboard and any future blocked-accounts report
would use). `version` column backs the optimistic-concurrency guard
every mutation (`accrue`, `reverseAccrual`, `recordPayment`) uses.

`CommissionLedgerEntry` — `@@unique([accountId, referenceType,
referenceId])` (the database-level exactly-once guarantee behind every
accrual/deduction; see §5 for its one known limitation),
`@@index([accountId])`, `@@index([accountId, createdAt])` (backs the
paginated ledger reads every one of Slice 5's three portals uses),
`@@index([type])`, `@@index([referenceType, referenceId])`.

`CommercialCreditSetting` — one row per `CommissionOwnerType`, no
scale concern (bounded cardinality: MERCHANT/DRIVER/RIDER, currently
two rows in active use).

No index gaps identified at current or foreseeable scale. Every read
path exercised by Slice 5's three portals and Slice 6's E2E spec goes
through an indexed lookup — no full-table scans.

## 3. Concurrency

Every real accrual/deduction call site (`MerchantSettlementService`'s
`accrueCommissionWithRetry()`/`applyAutomaticDeduction()`,
`RidePaymentService`'s `accrueDriverCommissionWithRetry()`) wraps its
`CommissionAccountService` call in a bounded 5-attempt retry loop
against `ConflictDomainException` (the optimistic-concurrency version
mismatch). This was discovered as a real gap in Slice 3, fixed there,
applied proactively in Slice 4 (verified, not rediscovered, on the
first test run — see `docs/DPX-COMMERCIAL-001-SLICE-4-RIDE-CASH.md`
§6), and is exercised by real-Postgres concurrency tests in
`merchant-settlement.service.spec.ts` (concurrent mode-B and concurrent
mode-A-deduction tests) and `ride-payment.service.spec.ts` (concurrent
cash confirmations for two different rides by the same driver). No new
concurrency surface was introduced by Slice 5 (pure reads) or Slice 6
(new tests only, no new mutation paths).

## 4. N+1 / query-efficiency review

- `MerchantCommercialController`/`DriverCommercialController`'s
  `GET .../account` — a single `getOrCreateAccount()` call, one query
  (or two on the very first call, for the lazy-create path).
- `.../ledger` — a single paginated `listLedgerEntries()` call, one
  indexed query plus one `count()`.
- Admin Portal's `/commercial` page picker — `listMerchants({ limit:
100 })` / `listDrivers({ limit: 100 })`, each a single paginated
  query; no N+1 (neither list endpoint hydrates per-row commission data
  — the picker only resolves a single selected owner's account on
  selection, not all 100 rows).
- `CommercialCreditSettingsService.getEffective()` — a single
  `findFirst` per owner type, called once per page load per credit-limit
  row (two calls total on the Admin Portal's monitoring card, not
  per-account).

No N+1 pattern found anywhere in the commercial read surface.

## 5. Real findings from writing this audit

1. **Manual admin payments are not idempotency-protected by the
   database, by design — flagged here rather than left implicit.**
   `AdminCommissionAccountsController.recordPayment()` calls
   `CommissionAccountService.recordPayment()` without a
   `referenceType`/`referenceId` (unlike every automatic accrual or
   deduction, which always supplies one). Postgres unique constraints
   treat `NULL` values as distinct from each other, so the
   `(accountId, referenceType, referenceId)` unique constraint does
   **not** prevent two manual payments from being recorded twice in a
   row (e.g. a double-click or a retried request with no idempotency
   key). This is a deliberate design choice — manual payments are
   genuinely repeatable admin actions with no natural single external
   reference to key on, unlike an order or a ride — but it means a
   double-submitted manual payment is a real, if narrow, operational
   risk: an admin who double-clicks "Record payment" could
   overcredit a merchant/driver's account. **Mitigation in place**:
   every `recordPayment()` call is fully audit-logged
   (`COMMERCIAL_AUDIT_ACTIONS.PAYMENT_RECORDED`, with `recordedBy` and
   `ipAddress`), so a duplicate is always traceable and reversible via
   a corrective manual entry — but nothing in the system today prevents
   it from happening in the first place. **Not fixed in this slice**:
   the founder's Slice 6 scope is verification/audit/documentation, not
   new engine behavior; recorded here as a known, accepted,
   non-blocking risk for a future slice (an idempotency-key parameter
   on the Admin Portal's payment form would close it) rather than
   silently left undocumented.
2. **`CommercialCreditSetting` has no per-account override** — one
   credit limit per owner _type_ (all merchants share one limit, all
   drivers share another), not per individual account. This was
   already a known, explicitly-scoped design decision from Slice 1
   (documented in the schema comment: "not built here"), reconfirmed
   here as still accurate and still out of scope — not a new finding,
   restated for this audit's completeness.
3. **No automated alerting on `blocked` transitions** — an admin only
   discovers a newly-blocked account by opening the Admin Portal's
   `/commercial` page and looking, or by the merchant/driver themselves
   noticing their own blocked-warning banner (Slice 5) and contacting
   support. There is no email/push notification fired on
   `commission_account.blocked`. This mirrors the same gap every other
   audited module (Wallet, Merchant) has independently accepted for its
   own equivalent state transitions — consistent with this platform's
   existing notification-scope decisions, not a commercial-specific
   regression.

No data-integrity, authorization, or correctness defect was found while
writing this audit — the three items above are operational-maturity
observations, not launch-blockers.

## 6. Readiness scorecard

| Area                             | Status                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Schema & migrations              | ✅ Applied, indexed, no gaps                                                                           |
| Exactly-once (accrual/deduction) | ✅ DB-level unique constraint + app-level pre-check                                                    |
| Exactly-once (manual payment)    | ⚠️ Not DB-enforced — accepted risk, §5.1                                                               |
| Concurrency                      | ✅ Bounded-retry pattern proven across 2 independent call sites                                        |
| Authorization                    | ✅ Global JWT + explicit per-controller permission grants                                              |
| Data isolation                   | ✅ Self-read scoped to JWT-derived `user.id`, no IDOR surface                                          |
| Audit logging                    | ✅ Two-tier: immutable ledger (every accrual/payment) + AuditLog (admin actions, blocking transitions) |
| N+1 / indexing                   | ✅ No gaps found                                                                                       |
| Alerting on blocking             | ⚠️ None — matches platform-wide precedent, §5.3                                                        |
| Per-account credit override      | N/A — explicitly out of scope since Slice 1                                                            |
| E2E lifecycle coverage           | ✅ `commercial-lifecycle.e2e.spec.ts` (Slice 6) + Slices 1-5's own specs                               |
| Reconciliation proof             | ✅ `docs/DPX-COMMERCIAL-001-SLICE-5-COMMERCIAL-RECONCILIATION.md`                                      |

## 7. Recommendation

DPX-COMMERCIAL-001 is production-ready. The two ⚠️ items (§5.1, §5.3)
are honest, non-blocking operational-maturity gaps consistent with this
platform's existing precedent for equivalent state transitions
elsewhere (Wallet, Merchant) — not defects introduced by this module,
and not required to close before founder freeze consideration. Both are
candidates for a future, explicitly-scoped slice if the founder wants
them closed, not a reason to reopen DPX-COMMERCIAL-001 now.

**Founder decision (2026-08-05): Approved & Frozen.** The founder
reviewed all three findings in this audit (§5, including the per-account
credit override item restated here) and confirmed each is correctly
classified as non-blocking, matching this recommendation exactly.
DPX-COMMERCIAL-001 is frozen under the platform's standard freeze policy
— critical security/defect fixes, performance improvements, compliance
updates, and explicit founder-approved enhancements only.
