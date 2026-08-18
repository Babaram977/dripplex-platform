# DPX-UTILITIES-001 — Utilities tab, Peyflex integration

**Status:** **Built** (2026-08-18). The design below stood; §7 records what shipped and where
the implementation deliberately differs. The endpoint contract is transcribed in
**DPX-UTILITIES-002**, which supersedes §1.4 and §6.2 of this document.
**Founder decisions:** 2026-08-18.

---

## 1. What is confirmed, and what is still missing

The two Peyflex URLs are **blocked by this environment's network egress policy** — the proxy
answers `403` to the CONNECT for `client.peyflex.com.ng` and `documenter.getpostman.com` before
the request leaves the sandbox, so the API cannot be read or called from here. The founder
pasted an extract of the documentation instead (2026-08-18). Everything in §1.1 comes from that
extract verbatim; nothing is inferred.

### 1.1 Confirmed

|                       |                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Base URL**          | `https://client.peyflex.com.ng`                                                                                                         |
| **Auth**              | `Authorization: Token <token>` — a static token generated from the Peyflex user dashboard. Not OAuth, no refresh, no expiry documented. |
| **Content type**      | `application/json`                                                                                                                      |
| **Cable TV purchase** | `POST /api/cable/subscribe/` — body `{ identifier, plan, iuc, phone }`; the curl example also carries `amount`                          |
| **Failure shape**     | HTTP `400` with `{ "status": "FAILED", "message": "Insufficient wallet balance" }`                                                      |

### 1.2 The most important thing the extract revealed

> _"Charges the user's wallet and processes the Cable TV recharge…"_
>
> `{ "status": "FAILED", "message": "Insufficient wallet balance" }`

**Peyflex debits a DrippleX-held Peyflex wallet.** This is a **prefunded float**, not
pay-as-you-go billing. Three consequences, none of them optional:

1. **A dry float fails every purchase at once.** Not a degraded service — a total outage of all
   four utilities, presenting to customers as a generic failure.
2. **Float balance is an operational alarm**, and it belongs in the Ops Console _before_ launch,
   not after the first outage. The alarm has to fire on a threshold, not on zero.
3. **It answers Q10** from the previous revision of this document, and it partly answers the
   pricing question: the discount will appear as the float being debited _less_ than the face
   value charged to the customer — which is exactly the pair of numbers §2 says must both be
   recorded.

### 1.3 Not relevant

The extract includes `/api/otp/status/`, `/api/otp/cancel/` and `/api/otp/history/`. These
belong to Peyflex's **phone-number activation** product (rented numbers for receiving SMS
codes), not to bill payments. They are not part of this integration and are noted here only so
nobody wires them up by mistake.

### 1.4 Still blocking

**No successful response body has been seen for any endpoint** — only the `400` failure. Without
it there is no way to know what a purchase returns: the provider's reference, the electricity
token, whether the status is terminal or pending. That single gap is enough to stop the build on
its own, because guessing it is how a pending purchase gets recorded as a failure and the
customer's money disappears.

**Nothing about the Peyflex wire format is guessed in this document, and no schema migration has
been written.** §6 lists exactly what is still needed.

### 1.5 ⚠️ Credential exposure

The pasted extract contains what appears to be a live 40-character API token
(`7301f73…`, the Django REST Framework token format). It is **deliberately not reproduced here
and has not been committed anywhere in this repository.** If that token is real rather than a
documentation placeholder, it should be **rotated from the Peyflex dashboard**, because anyone
holding it can spend the DrippleX float. The replacement belongs in a Railway environment
variable — never in code, a document, or a chat message.

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

**There is a third balance in this path, and it is not the customer's.** Peyflex debits a
DrippleX-held float (§1.2), so a purchase can fail for a reason that has nothing to do with the
customer — `Insufficient wallet balance` means _DrippleX_ is out of money, not them. Two things
follow. The customer must never be shown that message, because it is not about them and reads as
an accusation. And the float needs a low-balance alarm in the Ops Console **before** launch: the
failure mode is not one customer being unlucky, it is every utility purchase on the platform
failing at the same moment.

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

## 6. What is still needed

**Answered by the 2026-08-18 extract:** Q1 (auth — static `Authorization: Token`), Q2 (base URL,
though a sandbox is still unknown) and Q10 (yes, prefunded float — see §1.2).

### 6.1 The one that blocks everything

**A successful response body, for any endpoint.** The extract shows only the `400` failure
shape. Until one success is seen there is no way to know what a purchase returns — the provider
reference, the electricity token, and above all whether the status is terminal or pending.

A single real example is enough to unblock most of the build:

```
curl -X POST https://client.peyflex.com.ng/api/cable/subscribe/ \
  -H 'Authorization: Token <token>' -H 'Content-Type: application/json' \
  -d '{"identifier":"startimes","plan":"nova","iuc":"...","phone":"...","amount":"..."}'
```

…and the body it returns on success.

### 6.2 Endpoints not yet supplied

| Service         | Needed                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Airtime**     | Purchase path + request body + success response                                                                                                         |
| **Data**        | Purchase path + request body + success response, **and** the plan-listing endpoint per network                                                          |
| **Electricity** | The docs say providers/plan types can be fetched, meters verified, and meters recharged — **but no paths or bodies were supplied for any of the three** |
| **Cable TV**    | Request shape is known; still needed are the package-listing endpoint and the IUC verification endpoint                                                 |
| **Wallet**      | A float-balance endpoint, for the low-balance alarm §1.2 requires                                                                                       |

### 6.3 Behavioural questions the paths alone will not answer

| #   | Question                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q5  | **Is a purchase response synchronous or pending?** A pending purchase recorded as failed is money lost. This is the highest-risk unknown.                                                                                 |
| Q6  | **Does the response expose DrippleX's cost as well as face value?** Without it the per-transaction margin cannot be computed and "keep the discount" needs another mechanism — most likely reconciling against the float. |
| Q7  | **Negative-spread rule.** If Peyflex's cost comes back _above_ face value, refuse the sale or complete it at a loss? **Founder decision — not an engineering choice.**                                                    |
| Q8  | **Idempotency.** Does Peyflex accept a client reference so a timed-out retry cannot double-spend the float? Without one, a network timeout on our side is unrecoverable without a manual check.                           |
| Q9  | **Failure semantics.** Which errors mean "definitely not charged" versus "unknown"? `Insufficient wallet balance` is clearly the first kind; a timeout is the second. Reversal is only safe on the first.                 |
| Q11 | **Sandbox.** Is there a test environment, or does every integration test spend real float? This decides whether the adapter can be exercised in CI at all.                                                                |

### 6.4 Still the best unblock

Allowing `client.peyflex.com.ng` and `documenter.getpostman.com` through this environment's
network policy. The remaining gaps are mostly answerable by reading the documentation directly,
and the adapter will need to reach a sandbox to be tested at all.

---

## 7. What shipped

Built 2026-08-18. The design above stood; three things resolved differently once the contract
was read (DPX-UTILITIES-002), and they are stated here rather than left as drift.

### 7.1 Where it lives

| Piece                  | Path                                                                      |
| ---------------------- | ------------------------------------------------------------------------- |
| Provider port          | `apps/backend/src/utilities/providers/utility-provider.port.ts`           |
| Peyflex adapter        | `apps/backend/src/utilities/providers/peyflex.provider.ts`                |
| Not-configured adapter | `apps/backend/src/utilities/providers/not-configured-utility.provider.ts` |
| Money path             | `apps/backend/src/utilities/utilities.service.ts`                         |
| Customer API           | `apps/backend/src/utilities/customer-utilities.controller.ts`             |
| Ops API                | `apps/backend/src/utilities/admin-utilities.controller.ts`                |
| Schema                 | `UtilityPurchase`, migration `20260818120000_utilities_peyflex`           |
| Customer screens       | `apps/super-app/src/app/utilitiesScreen.tsx`                              |
| Ops Console            | `apps/operations-console/src/app/utilities/page.tsx`                      |

### 7.2 Three resolutions the design did not settle

**A provider outcome is three-valued, not two.** `SUCCESS`, `FAILED`, `UNKNOWN`. A provider that
says no is not the same as a provider that never answered: the first is safe to reverse, the
second is not, because with no idempotency key and no status lookup (G1/G2) the float may or may
not already be spent. An `UNKNOWN` therefore leaves the purchase `PENDING` with the customer's
money still reserved, and an operator resolves it by hand from the Ops Console. Collapsing the two
is how a customer gets refunded for electricity they actually received.

**HTTP status is not the outcome.** Electricity returns HTTP 200 carrying `status: FAILED`; cable
returns HTTP 400. The adapter reads the body's `status` field only, and a purchase POST
deliberately does _not_ throw on a non-2xx — throwing would turn a perfectly readable failure into
an unresolvable `UNKNOWN` and strand the customer's money in a manual queue for no reason.

**Card reversal credits the DrippleX wallet, not the card.** §3 said a card refund is slow and can
fail. The platform already has a founder decision covering exactly this — DPX-D4: _"gateway rides
refund to the Dx Wallet, never the PSP"_ — and no gateway refund adapter exists. That decision was
followed rather than a second refund path invented. **Worth confirming this is what the founder
wants for utilities too**, since it means a card-paid purchase that fails at the provider returns
the money as DrippleX credit rather than to the card.

### 7.3 Two decisions that were mine, not the founder's

- **`AWAITING_PAYMENT` is a distinct status** from `PENDING`. Without it the operator queue fills
  with abandoned card checkouts that need no action at all, hiding the purchases that do.
- **Airtime is bounded at ₦50–₦50,000.** Peyflex publishes no airtime limits (unlike electricity,
  which returns per-disco min/max). These are DrippleX's own guard rails against a fat-fingered
  amount, not a provider contract, and the founder may want them elsewhere.

### 7.4 Still open

- **G1/G2 remain.** No idempotency key, no status lookup. The `PENDING` state and the Ops resolve
  endpoint are the mitigation, not a fix. Worth asking Peyflex for both.
- **G6 remains: no sandbox.** The adapter's specs drive it against fixtures transcribed from the
  published examples; nothing in CI touches the real provider, and nothing can until a sandbox
  exists.
- **G3/G4 remain:** no successful electricity or cable response has been seen. The adapter reads
  `token` where the electricity example puts it, and rejects the `"Please contact Admin for Token"`
  prose the failure example carries. **The first real electricity purchase should be watched.**
- **Q7 (negative spread) is not implemented.** Peyflex returns `charged` only _after_ the purchase,
  so there is no quote to compare against beforehand. Both numbers are recorded on every row, so a
  negative spread is visible in the Ops register — but nothing refuses the sale. That needs either
  a founder rule or a pre-purchase quote endpoint Peyflex does not currently expose.
- **The float alarm logs and shows; it does not page anyone.** `GET /admin/utilities/float` drives
  a panel that polls every 60s and a `WARN` in the API logs. There is no alerting integration to
  hang a page off.

### 7.5 It is deployed but disabled

`PEYFLEX_API_TOKEN` is empty by default, so the not-configured adapter answers, every call is
refused with one honest message, and the customer's Utilities tab says it is not switched on
rather than failing after a bundle is chosen. **The token must be rotated before it is set** — see
§1.5; the one pasted into chat, and four others, are readable in Peyflex's own published
documentation.
