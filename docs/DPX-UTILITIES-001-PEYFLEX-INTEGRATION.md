# DPX-UTILITIES-001 — Utilities tab, Peyflex integration

**Status:** Design locked, build **blocked** on the Peyflex API contract.
**Founder decisions:** 2026-08-18.

---

## 1. Why this document exists rather than code

The founder supplied two Peyflex references:

- `https://documenter.getpostman.com/view/17835214/2sB34imLMn`
- `https://client.peyflex.com.ng/api/user/profile/`

**Both are blocked by this environment's network egress policy.** The proxy answers `403` to
the CONNECT for each host before the request leaves the sandbox:

```
documenter.getpostman.com:443 — gateway answered 403 to CONNECT (policy denial)
client.peyflex.com.ng:443     — gateway answered 403 to CONNECT (policy denial)
```

So the wire contract — paths, auth header, field names, error codes, whether a meter is
verified in a separate call — cannot be read from here.

**Nothing about the Peyflex wire format is guessed in this document, and no schema migration
has been written.** A bill-payment integration invented against an imagined contract is how a
customer gets charged for an electricity token that never arrives, and a migration shipped
against the wrong shape is expensive to unwind in production. The design below covers only what
the founder's own decisions determine; §6 lists precisely what is still needed.

---

## 2. Founder decisions (locked 2026-08-18)

| Decision        | Answer                                                                                  |
| --------------- | --------------------------------------------------------------------------------------- |
| Launch services | **Airtime, Data bundles, Electricity, Cable TV** — all four                             |
| Payment source  | **Wallet or card**                                                                      |
| Pricing         | **Keep the Peyflex discount** — the customer pays face value, DrippleX keeps the spread |

### What "keep the discount" forces into the design

If Peyflex sells ₦1,000 of airtime for ₦970 and the customer pays ₦1,000, DrippleX earns ₦30.
That is only auditable if **both numbers are recorded on every purchase** — what the customer
was charged, and what the provider actually cost. One field would make the margin invisible and
the books unreconcilable.

It also creates a real hazard: **if Peyflex's price moves between quote and purchase, the spread
can go negative** — DrippleX would pay more than it charged. The purchase path must compare the
provider's quoted cost against the face value _before_ committing, and refuse rather than
silently sell at a loss. This needs a founder rule (§6, Q7).

---

## 3. Money path

Utilities are the first feature where DrippleX pays an external party on the customer's behalf,
so the failure mode is money leaving without value arriving. The path below reuses machinery
that already exists and is already tested.

```
1. Quote        ask the provider what this costs; compare to face value
2. Reserve      debit the wallet, or authorise the card
3. Purchase     call the provider
4a. Success     record the provider reference and any delivered token
4b. Failure     reverse the reservation — wallet credit, or gateway refund
```

**Idempotency** reuses the wallet's existing guarantee: `WalletService.applyMutation` skips a
mutation that already has a ledger entry for the same `walletId + referenceType + referenceId`.
A utility purchase gets its own `referenceType`, paired with the purchase id, so a retried
request — or a duplicate tap on a weak connection — cannot debit twice. This is the same
mechanism ride settlement uses (`RIDE_WALLET_REFERENCE_TYPES`).

**Reversal on card differs from reversal on wallet, and that matters.** A wallet debit is
reversed by crediting the wallet — instant, local, cannot fail. A card charge is reversed by a
gateway refund, which is slow and can itself fail. The founder chose wallet-or-card knowingly;
the consequence is that a card-paid purchase that fails at the provider leaves a refund in
flight, and the customer must be told that plainly rather than shown a silent failure. The
existing ride refund path (DPX-D4) is the model.

**The delivered artifact must survive.** An electricity token or a recharge PIN is the thing the
customer bought. It has to be stored and re-displayable — a customer who closes the app and
loses the token has lost the money. This is not optional and is not a UI nicety.

---

## 4. Data model (shape, not yet a migration)

One table, not four. Every utility purchase identifies its target by a single string — a phone
number, a meter number, a smartcard number — so four nullable columns would be three-quarters
empty on every row.

| Field                | Purpose                                                         |
| -------------------- | --------------------------------------------------------------- |
| `serviceType`        | `AIRTIME` / `DATA` / `ELECTRICITY` / `CABLE_TV`                 |
| `customerId`         | Who bought it                                                   |
| `customerIdentifier` | Phone, meter or smartcard number — the thing being topped up    |
| `providerCode`       | Network or disco, from the provider catalogue, never free-typed |
| `planCode`           | Data bundle or cable package; null for airtime                  |
| `amountCharged`      | Face value — what the customer paid                             |
| `providerCost`       | What Peyflex charged. The spread is the margin (§2)             |
| `paymentMethod`      | `WALLET` / `PAYSTACK` / `FLUTTERWAVE`                           |
| `status`             | `PENDING` → `SUCCESSFUL` \| `FAILED` \| `REVERSED`              |
| `providerReference`  | Peyflex's own id, for reconciliation and disputes               |
| `deliveredToken`     | Electricity token or PIN — must be re-displayable (§3)          |
| `failureReason`      | Shown to the customer, and kept for support                     |

The provider catalogue (which networks, which data plans, which discos) is **read from Peyflex,
not stored as a constant.** Hardcoding a plan list guarantees it drifts out of step with what
Peyflex will actually sell, and the first symptom is a customer paying for a plan that no longer
exists.

---

## 5. Provider port

Peyflex is one implementation behind an interface, not called directly from the service. Two
reasons, both concrete: the platform has already had to safe-disable one payment provider
(OPay), and a utilities aggregator is exactly the kind of dependency that gets swapped.

The default implementation is a **not-configured** one that refuses every call with a clear
message, so the feature is deployed-but-disabled until credentials exist — the same pattern as
`MERCHANT_MODULE_ENABLED`. The Utilities tile stays badged **SOON** until the adapter is real.
It must not look live and fail.

Credentials go in Railway environment variables, never in code.

---

## 6. What is still needed — blocking questions

**Everything below needs the Peyflex documentation.** Any one of these unblocks it: allowing
`client.peyflex.com.ng` and `documenter.getpostman.com` through the environment's network
policy (best — testing needs it too), exporting the Postman collection to JSON, or pasting the
endpoint list.

| #   | Question                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Q1  | **Auth.** Header name, token format, and how a token is obtained — static API key, or login returning a bearer token that expires?                                                                     |
| Q2  | **Base URL and sandbox.** Is there a test environment, and does it differ by host or by key?                                                                                                           |
| Q3  | **Catalogue endpoints.** How are networks, data plans, discos and cable packages listed, and how often do they change?                                                                                 |
| Q4  | **Verification.** Are meter and smartcard verified in a separate call before purchase, and does that call cost anything or expire?                                                                     |
| Q5  | **Purchase response.** Is it synchronous, or does it return pending with a webhook or a status endpoint to poll? A pending purchase we treat as failed is money lost.                                  |
| Q6  | **Pricing visibility.** Does the API return DrippleX's cost as well as face value? If not, the margin cannot be computed per transaction and the "keep the discount" decision needs another mechanism. |
| Q7  | **Negative-spread rule.** If Peyflex's cost comes back _above_ face value, should the purchase be refused, or completed at a loss? (Founder decision needed — not an engineering choice.)              |
| Q8  | **Idempotency.** Does Peyflex accept a client reference to deduplicate a retried purchase? Without one, a network timeout on our side cannot be safely retried.                                        |
| Q9  | **Failure semantics.** Which error codes mean "definitely not charged" versus "unknown"? Reversal is only safe on the first kind.                                                                      |
| Q10 | **Float / funding.** Is the DrippleX Peyflex account prefunded? If so, a low balance is an operational alarm that needs surfacing in the Ops Console before purchases start failing.                   |

---

## 7. Current state of the code

Verified 2026-08-18: **no utilities scaffolding exists anywhere.** No Prisma models, no
endpoints, no shared types, no screens. The only trace is the `Utilities` quick-action tile on
the customer home screen, marked `ready: false` and badged SOON.

That tile stays as it is until the adapter is real.
