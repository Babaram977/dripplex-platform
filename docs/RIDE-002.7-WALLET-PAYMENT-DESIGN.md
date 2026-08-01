# RIDE-002.7 — Wallet & Payment Design Note

Written before implementation, per the founder's locked spec section 11 ("Reality Audit
First"). This documents what actually exists in Wallet/Ledger/Payment/payout/refund
infrastructure, the gaps that surfaced, and the decisions made to close them.

## Reality audit (verified before writing code)

**`WalletService`** — solid, directly reusable. `credit`/`debit`/`refund`/`settlement`/
`cashback`/`withdrawal`/`transfer`, all backed by `WalletLedgerEntry`, optimistic-locked
on `Wallet.version`, and idempotent on `(walletId, referenceType, referenceId)` — a
mutation with a reference that's already been applied is silently skipped rather than
double-applied. This is what makes ride settlement safely retryable.

**`WalletService.transfer()` is NOT reference-idempotent** — its input type has no
`referenceType`/`referenceId` parameters, unlike `credit`/`debit`. Using `transfer()`
directly for ride settlement would mean a retried settlement could double-move money.
Ride settlement therefore composes `debit` + `credit` pairs directly (both idempotent)
instead of calling `transfer()` — same net effect, safe to retry. `WalletService` itself
was not modified.

**`WalletOwnerType`** was `CUSTOMER | MERCHANT | RIDER` only — no `DRIVER`, no
`PLATFORM`. **Locked decision (founder, Option 1): add both**, via an additive Prisma
migration. Every driver gets a real wallet mirroring rider/merchant; a single
well-known `PLATFORM` wallet (fixed owner id
`00000000-0000-0000-0000-000000000001`, since `Wallet.ownerId` is a UUID column with no
real `User` row backing the platform) is the settlement clearinghouse — see below.

**Order payments and the Wallet module were completely disconnected** before this
milestone. `PaymentService.completeSuccessfulPayment` never touched `WalletService`;
`WalletEventsSubscriber`'s `PAYMENT_SUCCEEDED` handler was a literal no-op. There was no
existing "payment → split into recipient earnings + platform commission → credit
wallets" pattern anywhere to reuse — this milestone builds the first one, using
`WalletService`'s primitives.

**`PaymentProviderAdapter`** (Paystack/Flutterwave) exposes exactly `initializePayment`,
`verifyPayment`, `handleWebhook` — single-shot "pay this exact known amount," no
authorize/capture, no refund method. Precedent for adding a not-yet-configured
provider already existed: `MoniepointProvider` is a stub implementing the same
interface that throws `NotImplementedException` until real credentials are wired in.
`OpayProvider` follows the identical pattern (see "OPay" below).

**No payout/withdrawal-request workflow exists.** `WalletService.withdrawal()` just
debits the wallet and records a `WITHDRAWAL` ledger entry — there's no bank-account-
linked request/approval state machine, and `BankAccount` is merchant-only in the schema.
Out of scope for this milestone; flagged as a follow-up (see Business decisions below).

## The payment flow (locked by the founder, superseding an earlier draft)

An initial draft of this milestone charged the fare _before_ the ride started (mirroring
how e-commerce checkout works). The founder corrected this after reviewing it — Uber/Bolt
don't collect payment until the ride is complete, and charging upfront creates refund
and dispute complexity for every ride that doesn't finish cleanly (driver never arrives,
app crashes, wrong destination, accident, early cancellation). **Locked flow:**

```
Request Ride → Driver Accepts → Ride Starts (no money moves) → Ride Completes
  → Final fare known → Payment screen (Cash / OPay / Wallet / Card)
  → Payment successful → Driver credited, platform commission recorded → Receipt
```

No money moves during the trip. `RideTripService.completeTrip` (RIDE-002.6) only moves
the ride to `COMPLETED` — it does not touch payment status or wallets. Payment method
selection and settlement happen entirely in the new `RidePaymentService`, triggered by
the customer after completion.

**Fare finalization**: "final fare" in this milestone is the same `totalFare` computed
at request time — there is no live-trip-distance recalculation anywhere in the backend
(RideTracking records GPS points but nothing aggregates them into an actual-distance
figure). This is a known simplification, not something this milestone introduces or
hides; real fare finalization from live tracking is a separate piece of work.

**No authorization/capture was implemented** — per the founder's explicit instruction,
since the fare is fully known before the payment screen even appears, and per the
original spec's own principle ("do not implement new payment providers"/capabilities).
Gateway payment methods reuse `initializePayment`/`verifyPayment` exactly as checkout
does, just invoked after ride completion instead of before.

## Settlement design: the platform wallet as clearinghouse

Every ride's fare passes through the `PLATFORM` wallet; the driver's share is moved out
of it, leaving the commission behind automatically — no separate "commission credit"
step needed, and it unifies wallet and gateway payment methods onto the same mechanics:

- **Wallet**: `debit(customer, totalFare, ref=ride_fare:rideId)` →
  `credit(platform, totalFare, ref=ride_fare:rideId)` → `debit(platform, driverEarning,
ref=ride_earning:rideId)` → `credit(driver, driverEarning, ref=ride_earning:rideId)`.
  If the customer debit fails (insufficient balance), the ride stays `COMPLETED` (the
  trip already happened) but `paymentStatus` becomes `FAILED` — a real "settlement
  retry required" case, not swallowed.
- **Paystack / Flutterwave / OPay**: customer initializes a gateway payment
  (`RidePaymentTransaction`, a new table sibling to the existing order-scoped
  `PaymentTransaction` — kept separate rather than retrofitting the order table with a
  nullable `orderId`, for the same reason Ride never modifies `DeliveryJob`). On
  `verifyPayment` success: `credit(platform, totalFare, ref=ride_fare:rideId)` then the
  same driver payout pair as above.
- **Cash**: the driver already holds the cash physically — it never enters the digital
  ledger. No wallet mutation happens. `platformCommission`/`driverEarning` are computed
  and stored on the `Ride` row, and a `ride.cash_confirmed` audit log entry carries the
  same figures — satisfying "cash rides must still appear in accounting and reporting"
  without inventing an unsound one-sided ledger credit. **Actual collection of the
  commission owed on cash rides is not built** — see Business decisions below.

Every wallet-touching path is idempotent via `(referenceType, referenceId)`, so a
retried settlement (crash mid-sequence, duplicate request) can safely be re-run from
scratch — already-applied mutations are skipped by `WalletService.applyMutation`.

## OPay

The founder prioritized OPay for the Kano launch (cited ~70% local wallet adoption).
`PaymentProvider` and `RidePaymentMethod` both gained an `OPAY` value; `OpayProvider`
is registered in `PAYMENT_PROVIDER_ADAPTERS` alongside Paystack/Flutterwave/Moniepoint,
implementing the same interface — but, like `MoniepointProvider`, it throws
`NotImplementedException` on every method. **This is not a real integration** — there
are no OPay merchant credentials or API contract to build against. Selecting OPay as a
ride payment method today will fail clearly with "not implemented yet" rather than
silently doing the wrong thing. A real `OpayProvider` (HTTP calls, signature
verification) is follow-up work once OPay merchant credentials exist.

## Business decisions still required

- **`RIDE_PLATFORM_COMMISSION_RATE`**: currently `0.15` (15%), a placeholder constant
  marked `TODO: founder approval required before production` — same discipline as
  `RIDE_FARE_RATES`. Not a locked business figure.
- **Cash commission collection**: this milestone records what a driver owes the
  platform for cash rides (commission + earning figures on the `Ride` row, plus an
  audit trail) but does not collect it. Real-world options — deduct from the driver's
  next digital payout, direct debit, a running "payable" balance that blocks driver
  reactivation past a threshold — are a product decision, not an engineering one.
  Needs a decision before cash volume is meaningful (the founder flagged cash as
  important specifically for the Kano beta).
- **OPay real integration**: needs an OPay merchant account and API credentials before
  it can process a real payment; currently a registered-but-stubbed provider.
- **Driver payout/withdrawal workflow**: `WalletService.withdrawal()` exists as a raw
  ledger primitive; there's no bank-account-linked request/approval flow for drivers to
  actually get their wallet balance into their bank account. Out of scope here, flagged
  as a real gap for whenever driver cash-out becomes necessary.
- **Payment-before-dispatch gating**: this milestone does not require a payment method
  to be selected before a ride is dispatched, started, or completed — payment is purely
  a post-completion step, matching the locked flow. Whether the app should show a
  passenger their saved/default payment method earlier in the flow (without collecting
  money) is a product/UX decision for the frontend work, not a backend gate.
- **`WalletLedgerEntry` missing unique constraint**: carried over from RIDE-002.1 —
  declared in `schema.prisma`, never actually migrated in production. Still untouched
  by Ride work; still needs its own duplicate-row check before fixing.

## Quality gates run for this milestone

- `prisma validate` / `prisma migrate diff` re-check — clean, only the four pre-existing
  unrelated drift statements remain (see RIDE-002.1's note; still untouched)
- Migration applied via `prisma migrate deploy` against a fresh local Postgres
- Backend typecheck — clean
- Backend lint — clean
- Full backend test suite — 785/785 passing (up from 776 at RIDE-002.6), run both
  `--runInBand` and `--maxWorkers=2`
- New coverage: `ride-payment.service.spec.ts` (wallet settlement, insufficient-balance
  failure, cash confirmation, gateway initiate/verify success and failure, double-pay
  rejection, pre-completion rejection, and an explicit platform-wallet reconciliation
  check via `WalletService.reconcileWallet`)
