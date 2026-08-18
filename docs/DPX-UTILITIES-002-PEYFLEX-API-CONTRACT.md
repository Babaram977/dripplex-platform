# DPX-UTILITIES-002 — Peyflex API contract (as documented)

Read from the published Peyflex Postman collection on 2026-08-18, once
`client.peyflex.com.ng` was allowed through this environment's network policy.

**Nothing here is inferred.** Every path, field name and response body below is transcribed
from that collection. Where the documentation only shows a failure, this document says so
rather than imagining the success.

> **⚠️ The published Peyflex documentation leaks live API tokens.** The collection contains
> **five** distinct 40-character `Authorization: Token …` values in its saved examples, readable
> by anyone with the documentation link — one of them being the token pasted into chat. None is
> reproduced here and none is committed to this repository. Every one of them can spend a
> Peyflex float. This is Peyflex's own exposure as well as DrippleX's; ours must be rotated, and
> it is worth telling them about theirs.

---

## 1. Transport

|                |                                                                       |
| -------------- | --------------------------------------------------------------------- |
| Base URL       | `https://client.peyflex.com.ng`                                       |
| Auth           | `Authorization: Token <token>` (static, from the Peyflex dashboard)   |
| Content type   | `application/json`                                                    |
| Trailing slash | **Required** on every path. Django convention; omitting it redirects. |

### ⚠️ HTTP status is not the outcome

`POST /api/electricity/subscribe/` returns **HTTP 200** carrying:

```json
{ "status": "FAILED", "message": "Electricity recharge failed" }
```

…while `POST /api/cable/subscribe/` returns **HTTP 400** for a failure. **The HTTP code cannot
be trusted to decide whether a purchase worked.** The adapter must read the body's `status`
field and treat anything other than `"SUCCESS"` as a failure, whatever the status line says.
Trusting the code here would credit a customer for electricity they never received.

---

## 2. Endpoints in scope

Four services were chosen for launch. Peyflex also exposes betting, education, recharge-card
printing and virtual phone numbers — **out of scope**, listed in §5 so nobody wires them by
mistake.

### Account and float

| Method | Path                   | Returns                                                                                            |
| ------ | ---------------------- | -------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/user/profile/`   | `id, full_name, email, phone_number, wallet_credit, bonus_balance, pending_balance, kyc_status, …` |
| `GET`  | `/api/wallet/balance/` | `{ user_id, email, wallet_credit }`                                                                |

`wallet_credit` is **the DrippleX float**, not a customer's balance. This is the endpoint the
low-balance alarm reads.

### Airtime

| Method | Path                     | Notes                                                        |
| ------ | ------------------------ | ------------------------------------------------------------ |
| `GET`  | `/api/airtime/networks/` | `{ networks: [{ id, name }] }` — e.g. `mtn`, `glo`, `airtel` |
| `POST` | `/api/airtime/topup/`    | `{ network, amount, mobile_number }`                         |

```json
{
  "status": "SUCCESS",
  "reference": "202603091914NdL3liJe",
  "amount": "100",
  "charged": "98.99999999999999997918331829",
  "discount": "1.000000000000000020816681712",
  "balance": "1297.250000000000000020816682",
  "id": "mtn",
  "network": "MTN",
  "mobile_number": "08144216361",
  "timestamp": "2026-03-09T18:14:30.180100+00:00",
  "message": "Airtime topup successful",
  "transaction_id": 6268
}
```

### Data

| Method | Path                                    | Notes                                                                                    |
| ------ | --------------------------------------- | ---------------------------------------------------------------------------------------- |
| `GET`  | `/api/data/networks/`                   | `{ networks: [{ name, identifier }] }` — note `identifier`, **not** `id` as airtime uses |
| `GET`  | `/api/data/plans/?network=<identifier>` | `{ network, plans: [{ plan_code, amount, label }] }`                                     |
| `POST` | `/api/data/purchase/`                   | `{ network, mobile_number, plan_code }`                                                  |

Success mirrors airtime, plus `plan`, and with `charged` / `discount` present.

### Cable TV

| Method | Path                             | Notes                                                                                    |
| ------ | -------------------------------- | ---------------------------------------------------------------------------------------- |
| `GET`  | `/api/cable/providers/`          | `{ status, providers: [{ identifier, name }] }` — startimes, gotv, dstv                  |
| `GET`  | `/api/cable/plans/<identifier>/` | `{ status, provider, identifier, plans: [{ plan_code, amount, display, description }] }` |
| `POST` | `/api/cable/verify/`             | `{ iuc, identifier }` → `{ status, customer_name, iuc, provider }`                       |
| `POST` | `/api/cable/subscribe/`          | `{ identifier, plan, iuc, phone }`                                                       |

**Only a failure example is published** for `subscribe` (HTTP 400, `Insufficient wallet
balance`). The success shape is presumed to follow airtime and data but is **not confirmed** —
see §4.

### Electricity

| Method | Path                                                                                  | Notes                                                                                                  |
| ------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `GET`  | `/api/electricity/plans/?identifier=electricity`                                      | `{ status, provider, identifier, plans: [{ plan_id, plan_code, plan_name, min_amount, max_amount }] }` |
| `GET`  | `/api/electricity/verify/?identifier=electricity&meter=<n>&plan=<disco>&type=prepaid` | `{ status, customer_name, message }`                                                                   |
| `POST` | `/api/electricity/subscribe/`                                                         | `{ identifier, meter, plan, amount, type, phone }`                                                     |

Verification is a **GET with query parameters** here, but a **POST with a JSON body** for cable.
The two are not symmetrical and the adapter must not assume they are.

`min_amount` / `max_amount` differ per disco (Kaduna 1,100–100,000; Kano 500–500,000; Aba
100–400,000). These must be enforced in the UI, or the customer meets a provider rejection
after paying.

---

## 3. The pricing model works — `charged` and `discount` are returned

The founder's decision to keep the Peyflex discount is directly supported:

```
amount    100                  ← face value; what the customer pays
charged    98.99999999999…     ← what the float is actually debited
discount    1.00000000000…     ← the spread; DrippleX's margin
```

So `amountCharged` and `providerCost` in the DPX-UTILITIES-001 data model map to `amount` and
`charged`. The margin needs no separate reconciliation.

**Two cautions.** The figures come back at absurd precision (`98.99999999999999997918331829`)
and must be rounded to kobo at a single, deliberate point rather than drifting through the
arithmetic. And the data-purchase example shows `"discount": "0.00"` — **the discount is not
guaranteed on every service**, so a zero spread must be a normal outcome, not an error.

---

## 4. What the documentation still does not settle

| #      | Gap                                                                                                                                                            | Why it matters                                                                                                                                                                                 |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G1** | **No idempotency key.** No request accepts a client reference. Peyflex generates its own `reference` and returns it _in the response_.                         | If a purchase request times out, DrippleX has no reference and cannot ask "did that go through?" without a manual check. Retrying risks charging twice. **The single largest remaining risk.** |
| **G2** | **No transaction-status lookup** for airtime, data, cable or electricity. Recharge-card has `/api/rc/orders/<id>/`; the four in scope have nothing equivalent. | Compounds G1 — after a timeout there is no way to resolve the outcome programmatically.                                                                                                        |
| **G3** | **No successful electricity response.** The only example is a failure, where `token` reads `"Please contact Admin for Token"`.                                 | The field name `token` is known; its shape on success is not. An electricity token is the thing the customer bought.                                                                           |
| **G4** | **No successful cable response.**                                                                                                                              | Presumed to match airtime/data; unconfirmed.                                                                                                                                                   |
| **G5** | **`plan_code` is not unique in data plans.** `M2GBS` appears twice — ₦800 for 2 days and ₦1,505 for 1 month.                                                   | Keying a plan on `plan_code` alone would sell a customer the wrong bundle. Must key on `plan_code` **plus** `amount`.                                                                          |
| **G6** | **No sandbox documented.**                                                                                                                                     | Every integration test spends real float. Decides whether the adapter can be exercised in CI at all.                                                                                           |
| **G7** | **`amount` is absent from the documented cable subscribe body** but present in the founder's own curl.                                                         | Resolve before implementing; the plans endpoint supplies the amount either way.                                                                                                                |

G1 and G2 together are the reason the money path must record its own purchase row **before**
calling Peyflex, so a timeout leaves a `PENDING` record an operator can resolve by hand rather
than a silent gap.

---

## 5. Out of scope

`/api/v1/bet/*` (betting), `/api/education/*`, `/api/rc/*` (recharge-card printing) and
`/api/otp/*` (rented phone numbers for receiving SMS). Peyflex exposes them; DrippleX is not
launching them. Listed only so they are not wired up by accident.
