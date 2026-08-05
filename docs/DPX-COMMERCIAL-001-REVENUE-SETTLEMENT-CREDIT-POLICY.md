# 🔒 DPX-COMMERCIAL-001 — Platform Revenue, Settlement & Credit Policy (Founder Approved & Frozen)

Status: **🔒 Founder Approved & Frozen (2026-08-05).** Slices 1-6 are
implemented, verified, and shipped — merchant commission, driver
commission, credit limits, blocking/unblocking, automatic deduction,
manual settlement recording, and the commission ledger all derive from
this document, as built. The module now carries the platform's standard
freeze policy: critical security fixes, critical defect fixes,
performance improvements, compliance/regulatory updates, and explicit
founder-approved enhancements only — no routine feature additions. See
§7 for the full founder decision record.

## 0. Founder decisions (locked)

### 0.1 Sequencing (locked)

The founder approved this document as the platform's commercial policy of
record, and separately locked the implementation order:

1. **This document is locked** as the single source of truth for merchant
   commissions, driver commissions, credit limits, blocking/unblocking,
   automatic deductions, manual settlement recording, and the commission
   ledger — superseding any earlier, less-formal framing of the same
   ideas (e.g. the original DPX-MERCHANT-007 founder message).
2. **Slice 1 does not start yet.** Implementation touches financial
   workflows spanning both Marketplace and Ride; the founder wants the
   policy locked and the Merchant Portal's UI stable _before_ wiring the
   commercial engine into it, to avoid redesigning mid-build.
3. **Merchant Phase 2 continues first** — Reviews (done), Notifications,
   Analytics, and any remaining merchant screens. These don't touch
   financial behavior and move the Merchant Portal toward launch
   readiness independently.
4. **After Merchant Phase 2 reaches its production audit and freeze**,
   return to this document and implement the full Slice 1–6 plan (§6) as
   one coordinated package, against a now-stable Merchant Portal UI.

Locked order: Merchant Portal completion → Merchant module audit + freeze
→ Commercial Engine (this document) → Launch preparation.

### 0.2 Pay-down mechanism (locked)

On sequencing, the founder chose to pause all implementation and review
this document first, reasoning that changing how cash flows changes the
business model, not just the code — Founder Review before Implement, not
after, for this one.

On the pay-down mechanism, the founder locked the following policy
verbatim:

> DrippleX Commercial Policy: Outstanding platform commissions accumulate
> in a dedicated Commission Account. Online payments deduct commission
> automatically before settlement. Offline payments (merchant bank
> transfer, cash-on-delivery, ride cash) increase the outstanding
> commission balance until settled. Manual admin confirmation of external
> payments is supported. Every merchant and driver has an
> admin-configurable credit limit (default ₦10,000). Once the outstanding
> balance exceeds the limit, the merchant is blocked from receiving new
> orders and the driver is blocked from going online or accepting new
> trips until the balance is reduced below the threshold. Automatic
> deduction from future online settlements remains supported whenever
> applicable.

Concretely, this resolves §5's open item: **both** pay-down mechanisms are
in scope from Slice 1 onward, not sequenced as "manual first, automatic
later":

1. **Automatic deduction** — when a merchant/driver who has an outstanding
   commission balance earns money through mode A (online payment), the
   owed amount is deducted from that settlement before crediting their
   `Wallet`, rather than crediting the full net amount and leaving the
   commission balance untouched.
2. **Admin-manual recording** — an admin endpoint records an external
   payment (e.g. a bank transfer confirmed outside the app) against the
   `CommissionAccount`, reducing `outstandingBalance` immediately.

Both write a `CommissionLedgerEntry` of type `PAYMENT`; the account is
unblocked the moment `outstandingBalance` drops back to or below
`creditLimit`, regardless of which mechanism did it — this is what makes
it "one commercial system regardless of payment method," per the founder's
framing.

The founder also directed that the credit limit must **not** be a
hardcoded literal — see §3.2's revision below.

## 1. Founder-locked policy (source of truth)

Captured verbatim from the founder's instruction, reorganized for
implementation:

### 1.1 Three merchant payment modes

- **A. Online Payment** — customer pays through DrippleX (gateway or
  DrippleX wallet). Automatic settlement, automatic commission, wallet
  updates. **Already built** — this is the existing DPX-MERCHANT-002 model.
- **B. Pay to Merchant** (recommended default) — customer pays directly to
  the merchant's bank account or POS. DrippleX records only: commission
  owed, merchant credit balance. **Not built.**
- **C. Cash on Delivery** — customer pays cash to the rider on delivery.
  The rider confirms cash collected + amount received; the backend then
  allocates merchant amount, rider earnings, and DrippleX commission, all
  recorded in the ledger. **Partially built, and built backwards** — see
  §5.1.

### 1.2 Ride Delivery / Logistics cash

Same shape as Marketplace COD: the customer's cash belongs to the
merchant/driver, not to DrippleX. DrippleX must track cash collected,
merchant amount (marketplace case), delivery/ride earnings, platform
commission, and outstanding balances — not treat the cash as if DrippleX
received and is redistributing it.

### 1.3 Credit policy (applies identically to Merchant and Driver/Rider)

- Merchant: a **commission credit limit** (default ₦10,000, admin-configurable).
- Driver/Rider: a **platform fee/commission credit limit** (default ₦10,000,
  admin-configurable).
- Exceeding the limit:
  - Merchant → **cannot receive new orders** (existing orders continue to
    fulfilment).
  - Driver/Rider → **cannot go online for new work** (an already-accepted
    trip/delivery always finishes).
- Reactivation is automatic once the outstanding balance drops back within
  the limit (by the merchant/driver paying down the balance).

### 1.4 Recommended single document

The founder asked for this to be written up and locked as one commercial
framework spanning Merchant and Ride — this document.

## 2. Reality audit — what already exists

This audit is the reason this is a design doc and not a same-turn
implementation: two of the three payment modes already have real,
production code, and one of them is currently **modeling cash the wrong
way round**. Building B/C on top of that without fixing it first would
compound the mistake.

### 2.1 Marketplace — Cash on Delivery already exists, but mis-settles

`PaymentService.selectCashOnDelivery()` lets a customer choose CASH at
checkout for delivery orders; the order is confirmed with `paymentStatus:
PENDING`. When `DeliveryService.deliver()` fires `DELIVERY_COMPLETED`,
`CashSettlementSubscriber` calls `PaymentService.markCashPaymentReceived()`,
which flips `paymentStatus` to `PAID` and emits `ORDER_PAID`. The order
then flows through `OrderCompletionSweepService` to `COMPLETED`, which
fires `ORDER_COMPLETED` — the same event `MerchantSettlementService`
listens to for **online** payments.

**The problem**: this means a Marketplace COD order today credits the
merchant's DrippleX wallet with `gross − commission`, exactly as if
DrippleX had actually collected and was redistributing real money — but
DrippleX never touched that cash. The rider (or merchant, at the door)
physically holds it. The backend is telling the merchant "DrippleX owes
you ₦9,000" when the true relationship is "you already have ₦10,000 cash
in hand, you owe DrippleX ₦1,000 commission." This is the exact accounting
inversion the founder is describing, and it is live in the current
codebase.

There is also **no rider cash-collection confirmation step** at all
(`rider-delivery.controller.ts` has no cash-related endpoint) — the
settlement above fires automatically off `DELIVERY_COMPLETED`, with no
"I collected ₦X" input from the rider. Founder requirement 1.1(C) — "the
rider confirms cash collected + amount received" — does not exist.

### 2.2 Ride — cash commission is explicitly, deliberately unfinished

`RidePaymentService.confirmCash()` (driver-only) already computes the
fare split (`driverEarning`, `platformCommission`) and writes it into an
audit log entry, with this comment in the code itself:

> "Cash never enters the digital ledger — the driver already holds it
> physically. Commission is recorded for accounting/audit only; actual
> collection from the driver is a separate, not-yet-built reconciliation
> process (see design doc)."

`docs/RIDE-002.7-WALLET-PAYMENT-DESIGN.md` (written when this was built)
already names the exact three implementation options the founder is now
asking for, and defers the decision:

> "Real-world options — deduct from the driver's next digital payout,
> direct debit, a running 'payable' balance that blocks driver
> reactivation past a threshold — are a product decision, not an
> engineering one. Needs a decision before cash volume is meaningful."

**This confirms the founder's instinct is correct and overdue** — the Ride
side has been carrying this gap since RIDE-002.7, flagged honestly at the
time, never resolved.

### 2.3 Wallet cannot represent a credit/debt balance

`WalletService.debit()` hard-blocks going negative:

```
if (input.direction === WalletDirection.DEBIT && currentBalance.lessThan(input.amount)) {
  throw new ValidationDomainException('Insufficient wallet balance');
}
```

`Wallet` is an **asset-only** ledger (a merchant's or driver's own money).
"Commission owed" is a **liability** — DrippleX is owed money by the
merchant/driver, the opposite direction. This cannot be represented as a
negative `Wallet.availableBalance` without changing what `Wallet` means
platform-wide (risking every other module that assumes `availableBalance

> = 0`, including Withdraw and Transfer). **A new, separate ledger
construct is needed** — not a reuse of `Wallet`.

### 2.4 Blocking mechanisms — none exist yet

- No field on `MerchantProfile`/`Business` gates "can this merchant receive
  new orders" beyond `status`/`isApproved`/`suspendedAt` (none of which are
  wired to a commission-balance check).
- `RiderAvailability`/`DriverAvailability` ("go online") toggles have no
  balance/limit check today.
- `MerchantCommissionSetting` (the existing admin-configurable commission
  **rate**) is the closest precedent for an admin-configurable **credit
  limit** setting — same singleton-row, audit-logged pattern can be reused.

## 3. Proposed architecture

### 3.1 A new `CommissionLedger` (name TBC) — the liability side

A new model, deliberately separate from `Wallet`:

```
model CommissionAccount {
  id                 String   @id @default(uuid()) @db.Uuid
  ownerType          CommissionOwnerType   // MERCHANT | DRIVER | RIDER
  ownerId            String   // User.id
  outstandingBalance Decimal  @default(0)  // what they owe DrippleX right now
  creditLimit        Decimal  // snapshot of the limit in effect when accrued
  blocked            Boolean  @default(false)
  blockedAt          DateTime?
  ...
  @@unique([ownerType, ownerId])
}

model CommissionLedgerEntry {
  id            String   @id @default(uuid()) @db.Uuid
  accountId     String
  type          CommissionEntryType  // ACCRUAL | PAYMENT | ADJUSTMENT
  amount        Decimal
  balanceAfter  Decimal
  referenceType String?  // 'order' | 'ride' | 'delivery_job'
  referenceId   String?
  description   String?
  createdAt     DateTime @default(now())
}
```

Mirrors `Wallet`/`WalletLedgerEntry` deliberately (same shape the codebase
already trusts), but kept as its own model so a debt balance is never
confused with an asset balance, and so `WalletService`'s floor-at-zero
invariant is never touched.

**Accrual** happens when: a Marketplace order settles via mode B or C, or a
Ride/Delivery cash trip is confirmed — instead of (B/C) or in addition to
(C, for the rider/driver split) crediting an asset wallet, `commissionAmount`
is added to `outstandingBalance`.

**Payment** happens via either of the two founder-locked mechanisms in §0.2:
automatic deduction from a mode-A settlement, or admin-manual recording of
an external payment. Both reduce `outstandingBalance` and write a
`CommissionLedgerEntry` of type `PAYMENT`.

**Blocking** is a single boolean derived from `outstandingBalance >
creditLimit`, flipped by whichever service accrues/reduces the balance
(same "recompute and persist" pattern `DriverActivationService` already
uses for a conceptually similar gate).

### 3.2 Admin-configurable credit limits

New singleton-per-owner-type settings service, mirroring
`MerchantCommissionSettingsService`/`DriverSecuritySettingsService`
exactly: `CommercialCreditSettingsService` with `getEffective(ownerType)`
returning `{ creditLimit }`, admin `PATCH` endpoint, audit log on every
change, prospective-only (already-accrued balances keep the limit that was
in effect, exactly like `MerchantCommissionSetting.commissionRate`
snapshots into each `OrderSettlement`).

Per the founder's explicit instruction, ₦10,000 is **never** a hardcoded
literal in the service logic — it is only the seed/fallback value behind
two named constants (`DEFAULT_MERCHANT_CREDIT_LIMIT`,
`DEFAULT_DRIVER_CREDIT_LIMIT`), used solely to create the singleton row the
first time `getEffective()` runs with no row yet (same
get-or-create-singleton pattern `DriverSecuritySettingsService` already
uses). From then on, every read comes from the database row, and an admin
can raise a trusted merchant to ₦100,000 or drop a risky one to ₦2,000 from
the Admin Portal without a code change or deploy — this is the reason for
having a settings table instead of an environment variable.

### 3.3 New Order payment method — "Pay to Merchant"

`OrderPaymentMethod` gains one value (proposed name:
`MERCHANT_DIRECT`) for mode B. At checkout, selecting it confirms the
order immediately (like CASH does today) with `paymentStatus: PENDING`
— but unlike CASH, there is no rider/delivery collection step; the
merchant is trusted to have been paid directly. On order completion, the
`OrderSettlement` still gets created for the transparency record (gross,
rate, commission, "net" — though "net" is now notional, since the merchant
already has the gross), but instead of crediting `Wallet`, it accrues
`commissionAmount` to the merchant's `CommissionAccount`.

### 3.4 Fix Marketplace Cash on Delivery (mode C)

Two changes to the existing CASH flow:

1. **Add the missing rider confirmation step** — a new
   `POST /rider/delivery/:id/confirm-cash` (or similar) endpoint the rider
   calls with the amount actually collected, replacing the current
   automatic fire-on-`DELIVERY_COMPLETED` behavior. This directly answers
   founder requirement 1.1(C) ("the rider confirms cash collected + amount
   received") which the current code does not do at all.
2. **Change the settlement direction** — instead of crediting the
   merchant's `Wallet`, accrue `commissionAmount` to the merchant's
   `CommissionAccount` (same as mode B), and record the rider's delivery
   earning + platform commission split into the rider's own
   `CommissionAccount`/earnings the same way Ride cash does.

This is a **behavior change to code that has already shipped** — see §6.

### 3.5 Ride cash — close the gap RIDE-002.7 deferred

`RidePaymentService.confirmCash()` already computes the split and writes
the audit entry; it just needs one more call: accrue
`split.platformCommission` to the driver's `CommissionAccount` instead of
leaving it as an audit-only figure. This is additive, not a behavior
change — nothing currently reads or acts on that commission figure, so
wiring it into a real balance changes what becomes possible (blocking),
not what already happens.

### 3.6 Blocking enforcement points

- **Merchant "cannot receive new orders"**: gate at
  `CheckoutService`/order-creation time — reject creating a new order for a
  merchant whose `CommissionAccount.blocked === true`, the same way an
  unapproved/suspended merchant is presumably already rejected today
  (needs confirming during Slice 2 implementation — precedent check).
- **Driver/Rider "cannot go online"**: gate at the existing "go online"
  toggle for both `RiderAvailability` (Marketplace delivery) and
  `DriverAvailability` (Ride) — reject the toggle if
  `CommissionAccount.blocked === true`, mirroring how
  `DriverActivationService` already blocks a driver from operating for
  unrelated reasons (KYC, security lockout). Existing active trips/jobs are
  untouched — this is a new-work gate only, exactly as specified.

### 3.7 Admin/audit

`CommissionAccount`/`CommissionLedgerEntry` mutations and credit-limit
changes all go through `AuditService.record()`, same as every other
financially-sensitive mutation in this codebase (`MerchantSettlementService`,
`DriverSecuritySettingsService`, etc.) — no new audit pattern needed.

## 4. Frontend surfacing (later slices)

- **Merchant Wallet & Bank** (DPX-MERCHANT-007, already built) gains a
  "Commission owed" section once mode B/C exist — outstanding balance,
  credit limit, blocked/active status. Not built yet; the current screen
  only reflects mode A (online/net-settlement).
- **Driver-portal** earnings screen gains an equivalent "Platform fee
  owed" section + a blocked-state message on the go-online control.
- **Merchant-portal checkout config** (or wherever payment methods are
  chosen per-store) needs a way to enable/disable mode B for a given
  store — not designed yet.

## 5. Honest gaps this document does NOT resolve yet

1. **~~How does a merchant/driver actually pay down an outstanding
   commission balance?~~ Resolved — see §0.2.** Both automatic deduction
   (mode A) and admin-manual recording are in scope from Slice 1.
2. **Exact commission split formula for Marketplace delivery earnings**
   (rider's cut of the delivery fee vs. platform's cut) does not appear to
   exist anywhere in the current delivery module — `RideSettlementService`
   has this for rides (`computeSplit()`), but Marketplace `DeliveryJob` has
   no equivalent. This needs to be defined (or reuse the same
   admin-configurable-rate pattern) before mode C's rider-side accrual can
   be built.
3. **Payment method name.** `MERCHANT_DIRECT` above is a placeholder — any
   clear name works, this is not a decision that needs founder time.

## 6. Slice plan (approved; execution deferred per §0.1)

This spans two major backend domains (Marketplace + Ride) and changes the
settlement direction of code that is already live (Marketplace COD, tagged
in `v1.0-baseline`). Given the size and financial sensitivity, the plan
below is locked, but per §0.1 does **not** start until Merchant Phase 2
reaches its production audit and freeze:

- **Slice 1** (additive, no behavior change): `CommissionAccount` +
  `CommissionLedgerEntry` schema, `CommercialCreditSettingsService`
  (admin-configurable credit limits, `DEFAULT_MERCHANT_CREDIT_LIMIT` /
  `DEFAULT_DRIVER_CREDIT_LIMIT` seed constants only), admin-manual payment
  recording, audit actions, tests. Nothing existing changes behavior.
- **Slice 2**: Marketplace mode B ("Pay to Merchant") — new payment
  method, checkout wiring, commission-owed accrual, merchant blocking at
  checkout, automatic-deduction wiring for any merchant with an
  outstanding balance who also has a mode-A settlement.
- **Slice 3**: Fix Marketplace mode C (Cash on Delivery) — add the missing
  rider cash-confirmation step, change settlement direction from wallet
  credit to commission accrual. **This changes already-shipped behavior**
  — flagged explicitly for founder sign-off when this slice is reached,
  separately from the document-level approval below.
- **Slice 4**: Ride cash — wire `confirmCash()`'s already-computed
  commission into the same `CommissionAccount`, block "go online" past the
  limit.
- **Slice 5**: Frontend (merchant-portal Wallet & Bank + driver-portal
  earnings) + notifications on approaching/exceeding the limit.
- **Slice 6**: Full E2E verification + docs + freeze.

## 7. Status

✅ **Approved and locked** as the platform's commercial policy (§0.1, §0.2).

**Slice 1 shipped (2026-08-05)** — the founder confirmed the locked
sequence resumes now that DPX-MERCHANT-001 is 🔒 Approved & Frozen. See
`docs/DPX-COMMERCIAL-001-SLICE-1-FOUNDATION.md` for the full record:
`CommissionAccount`/`CommissionLedgerEntry`/`CommercialCreditSetting`
schema, `CommercialCreditSettingsService`, `CommissionAccountService`
(accrue/recordPayment/blocking primitives), admin endpoints + permissions,
SDK + shared types, 15/15 real-database tests, full backend verification
clean. Purely additive per §6 — no existing behavior changed, no real
accrual call site wired yet.

**Slice 2 shipped (2026-08-05)** — Marketplace mode B ("Pay to
Merchant"), founder-approved with an explicitly tight scope (commission
accrual wired into the approved settlement flow only, through the three
named integration points: `CheckoutService`, `PaymentService`,
`MerchantSettlementService` — no other frozen-module file touched). See
`docs/DPX-COMMERCIAL-001-SLICE-2-MODE-B.md` for the full record: new
`MERCHANT_DIRECT` payment method; merchant blocking enforced at checkout;
mode B accrues to `CommissionAccount` instead of crediting Wallet;
automatic deduction from mode-A (online) settlements before crediting
Wallet, explicitly excluding CASH (Slice 3's own separately-tracked
defect); mode B reversal on refund; a real concurrency bug found and
fixed by this slice's own concurrency test (two settlements racing on
the same `CommissionAccount` now retry with bounded backoff instead of
failing outright); 11 new real-database tests, full backend verification
clean (1285/1288, same 3 pre-existing unrelated failures as Slice 1).

**Slice 3 authorized (2026-08-05)** — founder sign-off for Slice 2 and a
separate, explicit authorization for Slice 3, held to "a higher bar"
because it changes already-shipped Marketplace behavior. Founder-locked
Slice 3 scope, verbatim:

> Slice 3 scope is limited to: Marketplace Cash on Delivery commercial
> correction; merchant commission accrual for COD; rider cash
> confirmation flow; correct commercial ledger entries; credit-limit
> interaction; exactly-once guarantees; audit trail; real Postgres
> verification; concurrency testing. Nothing else. Do not redesign
> checkout. Do not redesign Rider. Do not redesign Marketplace. Do not
> introduce new payment methods.

The founder additionally required one extra artifact before Slice 3 can
be brought back for review — a **Cash Flow Verification** document,
narrating a complete COD order end-to-end (Customer Order → Merchant
Accepts → Rider Picks Up → Customer Pays Cash → Rider Confirms
Collection → Merchant Commission Accrual → CommissionAccount Update →
Blocking/Unblocking Logic → Commercial Ledger → Audit Trail →
Exactly-once Verification), proving every monetary movement is correct.

The mode-A-deduction-refund reconciliation gap (§5.6 of the Slice 2 doc)
remains **explicitly out of scope** for Slice 3 and every future slice
until the founder scopes it in by name — the founder approved leaving it
undone rather than inventing refund-compensation policy.

**Slice 3 shipped (2026-08-05)** — Marketplace Cash on Delivery
commercial correction, founder-authorized with the same tight,
integration-point-scoped discipline as Slice 2. See
`docs/DPX-COMMERCIAL-001-SLICE-3-COD-CORRECTION.md` for the full record
and `docs/DPX-COMMERCIAL-001-SLICE-3-CASH-FLOW-VERIFICATION.md` for the
founder-required end-to-end narrative: a new rider cash-confirmation
step (`DeliveryService.confirmCash()`) replaces the old automatic
fire-on-`DELIVERY_COMPLETED` settlement; CASH now accrues commission
onto the merchant's `CommissionAccount` instead of crediting Wallet
(the exact bug §2.1 described, now fixed); credit-limit blocking was
already covered uniformly by Slice 2's checkout-time gate, no new
wiring needed; a real concurrency bug (two different orders for the
same merchant racing on the shared `CommissionAccount`) was found and
fixed by this slice's own concurrency test, via a bounded-retry wrapper
applied to both the accrual and reversal paths. Driver/rider earnings
for Marketplace delivery jobs remain deliberately unbuilt — no split
formula exists yet (§5 item 2 below), and building one would mean
inventing policy outside this slice's named scope.

**Slice 4 authorized (2026-08-05)** — founder sign-off for Slice 3.
Founder-locked Slice 4 scope, verbatim:

> Claude should only address the Ride-side commercial behavior that
> mirrors what Slice 3 corrected for Marketplace. Specifically: Ride
> cash commission accrual; Driver CommissionAccount integration; Cash
> confirmation commercial flow; Automatic credit-limit enforcement;
> Commercial ledger; Exactly-once guarantees; Concurrency testing; Real
> Postgres verification; Cash Flow Verification document. No Ride
> redesign. No Driver redesign. No pricing redesign. No UI redesign
> beyond what is strictly necessary for the approved commercial
> workflow.

**Slice 4 shipped (2026-08-05)** — Ride Cash Commercial Correction. See
`docs/DPX-COMMERCIAL-001-SLICE-4-RIDE-CASH.md` for the full record and
`docs/DPX-COMMERCIAL-001-SLICE-4-CASH-FLOW-VERIFICATION.md` for the
end-to-end narrative. Unlike Marketplace COD, Ride's cash-confirmation
flow (`RidePaymentService.confirmCash()`) already existed in full from
RIDE-002.7 — the only gap, flagged honestly in that slice's own design
doc, was that the computed platform commission was audit-only. Slice 4
closes exactly that gap: the commission now accrues onto the driver's
`CommissionAccount` (no schema change needed — `CommissionOwnerType.
DRIVER` and the `'ride'` reference type were already defined in Slice
1); going online is now blocked for a driver whose account exceeds the
credit limit (`RidesService.updateDriverAvailability()`, mirroring the
existing identity-verification gate beside it); the bounded-retry
pattern Slice 3 discovered was needed was applied proactively here and
verified (not rediscovered) by a passing concurrency test on the first
try.

**Slice 5 authorized (2026-08-05)** — founder sign-off for Slice 4.
Founder-locked Slice 5 scope, verbatim:

> DPX-COMMERCIAL-001 Slice 5 — Commercial Visibility. The scope should
> remain focused on surfacing the commercial engine that now exists,
> not changing its behavior. Merchant: outstanding commission, credit
> limit, available credit, commercial ledger/history, commission
> status, blocked warning (where applicable). Driver: outstanding
> commission, credit limit, available credit, commercial ledger/
> history, blocked warning, settlement history. Admin: commercial
> dashboard, merchant commission accounts, driver commission accounts,
> outstanding balances, manual payment recording, credit-limit
> monitoring. Rules: no redesign of Merchant Portal, Driver Portal, or
> Admin Portal. Continue using the approved DDS and do not modify
> Figma-locked shared components. Compose the new views using existing
> design patterns. Reuse existing backend and SDK surfaces wherever
> possible. Only add backend APIs if the current commercial engine
> genuinely lacks read endpoints.

Additional founder-required artifact before Slice 5 review: a
**Commercial Reconciliation Verification** document, showing for
representative Merchant and Driver scenarios that commission accrued,
commission paid, outstanding balance, available credit, and current
blocked/unblocked status all reconcile exactly with the Commission
Ledger and Commission Account — the founder named this as "the final
proof that the commercial engine is internally consistent before we
consider freezing DPX-COMMERCIAL-001."

**Slice 5 shipped (2026-08-05)** — implemented per the locked scope
above. Two genuinely-missing backend self-read endpoints added
(`MerchantCommercialController`, `DriverCommercialController`, mirroring
`MerchantWalletController`/`DriverWalletController` exactly); the Admin
Portal's commercial dashboard reuses the Slice-1 admin endpoints
unchanged, composed with the pre-existing merchant/driver list
endpoints for the account picker. Merchant Portal and Driver Portal
gained commercial-visibility cards on their existing Wallet/Earnings
pages; Admin Portal gained its first real nav shell and a `/commercial`
page. No accrual, blocking, or payment logic changed. Full detail:
`docs/DPX-COMMERCIAL-001-SLICE-5-COMMERCIAL-VISIBILITY.md`. The
required Commercial Reconciliation Verification:
`docs/DPX-COMMERCIAL-001-SLICE-5-COMMERCIAL-RECONCILIATION.md` —
real-Postgres proof that, for representative Merchant and Driver
scenarios, commission accrued/paid, outstanding balance, available
credit, and blocked/unblocked status all reconcile exactly against the
Commission Ledger and Commission Account.

**Slice 6 authorized (2026-08-05)** — founder sign-off for Slice 5.
Founder-locked Slice 6 scope, verbatim:

> DPX-COMMERCIAL-001 Slice 6. This is not another feature slice. It is
> the completion slice. Its scope should be limited to: End-to-End
> Verification — validate the entire commercial lifecycle for
> Marketplace Mode A, Marketplace Mode B, Marketplace Cash on Delivery,
> Ride Cash, Merchant blocking/unblocking, Driver blocking/unblocking,
> Manual payment recording, Automatic deduction, Ledger integrity,
> Credit-limit behavior. Security Review — authorization, permission
> boundaries, commercial data isolation, commercial endpoints, audit
> logging, replay/idempotency risks. Production Audit — the same
> production-grade audit used for Wallet, Driver, Operations, and
> Merchant. Documentation — update DPX-COMMERCIAL-001, Production
> Audit, Reality Audit, Release History, Module Completion Gate.
> Founder Review — return for final approval. Do not freeze
> automatically. One final requirement: include a Platform Commercial
> Readiness Matrix summarizing every supported payment path and its
> commercial outcome (commission accrual, auto deduction, manual
> settlement, credit limit, ledger, verified) — the definitive
> launch-readiness reference for the commercial engine.

**Slice 6 shipped (2026-08-05)** — implemented per the locked scope
above. New end-to-end lifecycle spec
(`apps/backend/src/commercial/commercial-lifecycle.e2e.spec.ts`, 2/2
passing against real Postgres) proving the cumulative, cross-payment-
method behavior of a real merchant/driver account over time (Mode B →
Cash → blocked → manual payment → unblocked → Mode A auto-deduction, and
the driver equivalent). Security review found no authorization bypass,
data-isolation failure, or unaudited write path. Production audit found
three honest, non-blocking operational-maturity gaps (manual-payment
idempotency, no per-account credit override, no blocking-transition
alerting), none launch-blocking. Full detail, the Platform Commercial
Readiness Matrix, and documentation-update summary:
`docs/DPX-COMMERCIAL-001-SLICE-6-COMPLETION.md`. Production audit:
`docs/DPX-COMMERCIAL-001-PRODUCTION-AUDIT.md`. Per the founder's
explicit instruction, this does **not** freeze DPX-COMMERCIAL-001
automatically — returned for founder review.

Slice 6 is the last planned slice — see §6.

**Founder Approved & Frozen (2026-08-05).** Founder review of the Slice 6
completion report, verbatim decision:

> Founder Review — DPX-COMMERCIAL-001 (Module-Level). Decision: ✅
> Approved. After reviewing the completion report, I consider
> DPX-COMMERCIAL-001 functionally complete and consistent with the
> commercial policy that was approved before implementation began... The
> three remaining findings are correctly classified [manual-payment
> idempotency, per-account credit overrides, blocking-transition alerts —
> all non-blocking]... The module has completed the same lifecycle as the
> other production modules: Reality/Policy definition, Implementation,
> Verification, Concurrency testing, Security review, Production audit,
> Founder review. That satisfies the DPX-100 governance process. Founder
> Decision: 🔒 DPX-COMMERCIAL-001 — Revenue, Settlement & Credit Policy.
> Status: Founder Approved & Frozen.

DPX-COMMERCIAL-001 now carries the platform's standard freeze policy:
critical security fixes, critical defect fixes, performance improvements,
compliance/regulatory updates, and explicit founder-approved enhancements
only — no routine feature additions. The three §5 production-audit
findings (manual-payment idempotency, no per-account credit override, no
blocking-transition alerting) are confirmed non-blocking and carried
forward as candidates for a future, explicitly-scoped enhancement rather
than a reason to reopen this module. The Platform Commercial Readiness
Matrix (`docs/DPX-COMMERCIAL-001-SLICE-6-COMPLETION.md` §5) is designated
by the founder as permanent commercial documentation.

With this freeze, the platform's frozen core modules are: Wallet,
Marketplace, Ride, Driver, Operations, Merchant, and Commercial Engine
(DPX-COMMERCIAL-001) — completing the platform's core commerce and
mobility foundation. Per founder direction, no further feature modules
open next; the platform moves into Launch Mode (Railway production
deployment, platform-wide launch verification, App Store/Google Play
readiness, end-to-end production validation, security/performance/
monitoring hardening, Beta/UAT and launch execution).
