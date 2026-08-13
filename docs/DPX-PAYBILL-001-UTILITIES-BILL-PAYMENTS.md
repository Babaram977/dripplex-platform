# DPX-PAYBILL-001 — Paybill / Utilities Bill Payments: Design

Founder-directed (2026-08-13) as a new super-app service: customers buy
airtime & data and pay utility bills (electricity, cable TV, and more)
from inside DrippleX, funded from their wallet **or** directly via
card/bank. This document records the locked founder decisions and the
provider-agnostic architecture so the build can start the moment the
fulfilment provider's API is available. It invents **no** provider
contract, enum, or endpoint — per the engineering playbook (§3), the
provider integration is stated as a dependency, not filled in.

Status: **DESIGN — build blocked on one dependency (provider API docs +
sandbox credentials). Domain design is provider-agnostic and unblocked.**

## 1. Founder decisions locked (2026-08-13)

1. **Fulfilment provider:** Founder has one in mind — **Payflex**
   (payflex.ng). Payflex is a Nigerian consumer bills fintech covering the
   right categories; DrippleX needs its **partner/reseller (VTU) API** —
   docs + sandbox credentials — to build the adapter. **Open item:** if
   Payflex does not expose a partner API, substitute a documented
   aggregator (Reloadly / eBills / Paybeta / Monnify Bills / Bloc) behind
   the same adapter seam. **The adapter contract is NOT designed here —
   it waits on the chosen provider's real API.**
2. **Revenue model:** **Aggregator rebate.** The customer pays face value
   (no convenience markup); DrippleX earns the commission the provider
   pays per transaction. Accounted off-transaction into a commission
   ledger, not added to the amount the customer sees.
3. **Launch scope:** **Full utilities** from the start — airtime, data,
   electricity, cable TV, and the provider's remaining categories
   (water / internet / betting / education as the provider supports).
   Electricity and cable require a customer identifier
   (meter / smartcard number) and its validation, plus async token /
   receipt delivery.
4. **Funding sources:** **Wallet + card/bank.** A bill can be paid by
   debiting the DrippleX wallet, or paid directly through the existing
   payment gateway without pre-funding the wallet.

## 2. Why this belongs in DrippleX

Bill payments are the highest-frequency transaction category in the
Nigerian super-app pattern and the strongest wallet-flywheel driver:
recurring airtime/data/electricity purchases pull balance into the wallet,
which then feeds rides, orders, and transfers. It monetises from day one
via the provider rebate. The Home screen already reserves a **Utilities
⚡** quick-action tile (`apps/super-app/src/app/homeScreen.tsx`,
`QUICK[]`), currently a documented dead-end ("not built yet — no
destination") — this design gives it a destination.

## 3. Money-movement rigor (reuse, don't reinvent)

A bill payment is money out with a delivery guarantee: a failed electricity
purchase must auto-reverse to the funding source. The same discipline the
ride/settlement work already established applies — idempotency, async
status reconciliation, and reversal-on-failure. Reuse:

- The **wallet ledger** and its atomic debit/credit patterns
  (`apps/backend/src/wallet/*`) for the wallet funding path and for
  reversals.
- The existing **payment gateway** path for the card/bank funding option
  (the same gateway used at order/ride checkout) — no new gateway.
- The **commission config** precedent from DPX-COMMERCIAL-001 for how a
  provider rebate rate is stored and applied.

## 4. Domain model (provider-agnostic)

All provider-specific values (biller codes, product codes, category names)
are **synced from the provider**, never hard-coded, so a provider swap is a
data change, not a schema change.

- **`BillerCategory`** — AIRTIME · DATA · ELECTRICITY · CABLE_TV ·
  WATER · INTERNET · BETTING · EDUCATION. (Final set = the intersection of
  this list and what the chosen provider actually offers; unsupported
  categories are simply not synced.)
- **`Biller`** — a specific biller under a category (e.g. an airtime
  network, a disco, a cable provider). Fields: display name, logo,
  category, `providerBillerCode` (opaque, from provider), `customerRefType`
  (NONE | PHONE | METER | SMARTCARD | ACCOUNT), `customerRefLabel`,
  min/max amount (for variable billers), `isActive`.
- **`BillerProduct`** — a fixed package under a biller (a data bundle, a
  cable plan). Fields: name, `providerProductCode`, price, `isActive`.
  Variable-amount billers (airtime, electricity) have no products; the
  customer enters an amount within min/max.
- **`BillPayment`** — the transaction. Fields: `userId`, `billerId`,
  `billerProductId?`, `customerReference` (meter/phone/smartcard/account),
  `amount`, `rebateAmount`, `currency`, `fundingSource` (WALLET | GATEWAY),
  `walletTxnId?` / `gatewayReference?`, `providerReference?`, `status`,
  `receipt` (JSON — e.g. electricity token, provider receipt id),
  `idempotencyKey`, `createdAt`, `completedAt?`, `failureReason?`.

### 4.1 `BillPayment` state machine

```
PENDING ──► PROCESSING ──► SUCCESS
                │
                ├────────► FAILED ──► REVERSED   (funds returned to source)
                └────────► SUCCESS-UNCONFIRMED ──► (reconciler) ──► SUCCESS | REVERSED
```

- **PENDING** — created, funds authorised/held on the funding source.
- **PROCESSING** — provider called; awaiting provider confirmation.
- **SUCCESS** — provider confirmed fulfilment; receipt/token stored.
- **FAILED** — provider rejected; funds released/refunded → **REVERSED**.
- **SUCCESS-UNCONFIRMED** — provider call timed out / ambiguous; a
  reconciler polls the provider's status endpoint before deciding
  SUCCESS vs REVERSED. **Never** double-charge and **never** silently
  keep money on an unfulfilled bill.

Idempotency: every payment carries an `idempotencyKey`; a retry with the
same key never creates a second provider call or a second debit.

## 5. Funding paths

- **Wallet:** atomic wallet debit → provider call → on FAILED, atomic
  wallet credit (reversal), all against the immutable ledger. Insufficient
  balance is rejected before any provider call.
- **Card/bank (gateway):** authorise via the existing gateway → provider
  call → on FAILED, gateway refund/void. No wallet pre-funding required.

## 6. Revenue — rebate accounting

Customer is charged **face value**. The provider's per-transaction rebate
(rate or amount, provider-supplied) is recorded on the `BillPayment`
(`rebateAmount`) and posted to a DrippleX commission/revenue ledger on
SUCCESS — mirroring how DPX-COMMERCIAL-001 accounts merchant commission.
No markup is shown to or taken from the customer.

## 7. Customer API surface (provider-agnostic, illustrative)

These are DrippleX's own endpoints; they do **not** expose or assume the
provider's shape. Final contract to be confirmed against the Figma design
and the provider's capabilities.

- `GET  /billers?category=…` — list active billers (synced catalogue)
- `GET  /billers/:id/products` — fixed packages for a biller
- `POST /bills/validate` — validate a customer reference (meter/smartcard)
  where the biller requires it, returning the resolved customer name
- `POST /bills/pay` — create a `BillPayment` (biller, product/amount,
  customerReference, fundingSource, idempotencyKey)
- `GET  /bills/:id` — payment status + receipt/token
- `GET  /bills` — customer's bill-payment history

## 8. Provider adapter — the seam (contract pending)

A single `BillProvider` interface isolates every provider call:
`syncCatalogue()`, `validateCustomer()`, `purchase()`, `getStatus()`.
The **method signatures and DTOs are intentionally left open** until the
chosen provider's API docs are in hand — defining them now would be
inventing a contract. The Payflex (or alternative aggregator) adapter is
the only component blocked on the dependency; everything in §4–§7 can be
built and unit-tested against a mock adapter first.

## 9. Suggested phasing (de-risks the money loop)

Even with "full utilities" as the target, sequence the build so the
money-movement loop is proven on the simplest case first:

1. Catalogue sync + **airtime/data** (variable + fixed, instant
   fulfilment) end-to-end: wallet & gateway funding, receipt, reversal.
2. **Electricity** — adds customer-ref validation + async token delivery +
   the reconciler for SUCCESS-UNCONFIRMED.
3. **Cable TV**, then the provider's remaining categories.

## 10. Open items / founder confirmations needed

1. **Payflex partner/reseller API** — docs + sandbox credentials. If none
   exists, confirm the substitute aggregator. **(Blocks the adapter and
   therefore any live transaction.)**
2. Confirm the provider's actual category coverage (drives the final
   `BillerCategory` set).
3. Confirm the provider's rebate model (rate vs. flat, per category) for
   the commission-ledger config.
4. Figma: is there a designed Utilities / Paybill flow, or does it need to
   be generated? (The Home Utilities tile exists; the flow screens do not.)

## 11. Baseline verified (2026-08-13)

- No bill/utility/airtime/biller domain exists in `apps/backend` today
  (grep of `prisma/` + `src/`): this is greenfield.
- `apps/super-app` Home screen has a `Utilities` quick action with no
  destination (documented gap) — the entry point exists, the feature does
  not.
