# DPX-MKT-INT-001-P1-POS-LAUNCH-GATE-8H — the POS production-readiness gate

**Assessed:** 2026-09-14 · **criterion 4 re-assessed 2026-09-15**
**Against:** `main` @ `924e2ae4`, backend deployment `60fdf316`; criterion 4 against the
production inventory run on 2026-09-15
**Nature:** 8H is a gate, not an implementation unit. It reads the other seven and reports
whether the POS integration is ready to be called production-ready.

---

## Verdict

**All six criteria now pass.** Criterion 4 was the sole outstanding one; the read-only production
inventory it waited on was run on 2026-09-15 and returned zero on all six values.

**This does not declare DrippleX, or the POS integration, launch-ready.** 8H reads six specific
criteria about POS production-readiness. It does not assess operational readiness, merchant
onboarding, support, or anything outside its own scope, and a gate passing is not a launch
decision. That decision is the founder's and is taken separately.

Two things about criterion 4's resolution should travel with it rather than be lost in the tick:

- It passes because the credential population is **empty**, not because a population was examined
  and found safe. An inventory of nothing is a weaker assurance than an inventory of something
  compliant, and it says nothing about credentials provisioned after 2026-09-15.
- A POS integration with zero provisioned credentials means **no merchant is currently
  authenticated against it**. Whether that is expected at this stage is a product question,
  recorded and deliberately unanswered here.

| #   | Criterion                                                    | Verdict                                          |
| --- | ------------------------------------------------------------ | ------------------------------------------------ |
| 1   | All required HTTP journeys green                             | ✅                                               |
| 2   | DB assertions actually executed                              | ✅                                               |
| 3   | No critical expected-to-fail item left unexplained           | ✅ (three markers, all explained, none critical) |
| 4   | **Compatibility impact resolved**                            | ✅ **resolved 2026-09-15 — see §4**              |
| 5   | No unauthorized financial effect                             | ✅ (with a structural caveat, §5)                |
| 6   | Merchant can onboard with the credential DrippleX gives them | ✅                                               |

---

## 1 · All required HTTP journeys green ✅

Four HTTP suites drive the running API over real HTTP and read the response body, so what is
proved is which handler answered — not merely that Nest reported a route as `Mapped`.

| Unit                                  | Spec                                                                                                              |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 8A onboarding                         | `pos-onboarding.http.spec.ts`                                                                                     |
| 8B catalogue & inventory              | `pos-catalogue-inventory.http.spec.ts`                                                                            |
| 8C order flow · 8E financial boundary | `pos-order-flow.http.spec.ts`                                                                                     |
| Merchant Connect (reader + guard)     | `merchant-conflicts`, `merchant-imported-products`, `merchant-module-guard-{on,off}`, `webhook-https-enforcement` |

Backend suite at the time of assessment: **321 suites, 3376 tests, green**.

**One qualification, stated rather than buried.** Three rides/delivery specs
(`ride-dispatch.service.spec.ts`, `dispatch-flow.spec.ts`, `rides.service.spec.ts`) are
non-deterministic under full-suite concurrency on a shared local database. Each passes 3/3 in
isolation; the family was demonstrated to fail on clean `main` with unrelated changes stashed, and
CI has not reproduced it in eight consecutive runs. It is unrelated to POS, and it is recorded as
an open finding rather than counted against this gate — but a suite that fails roughly one run in
two locally will eventually cost a cycle, and it deserves its own increment.

## 2 · DB assertions actually executed ✅

The 8G invariant was that a DB-backed test with no database must report **skipped**, never
**passed**, and that an HTTP suite must **fail** rather than skip when the API will not boot — a
quietly-skipping HTTP suite is precisely the hole that let the dead-credential defect through.

- `test/jest-global-setup.ts` arms whenever `CI=true` **or** `DATABASE_URL` is set, and throws if
  Postgres or Redis is unreachable. CI sets `CI=true`, so the suite cannot go green in a job with
  no database.
- DB-backed specs gate on `(DATABASE_CONFIGURED ? it : it.skip)`, which produces a real skip.

## 3 · No critical expected-to-fail item left unexplained ✅

Three `it.failing` markers exist. All three are the **same defect**, all are tagged `[PENDING B6]`,
and each carries a comment naming the behaviour and why it is pinned:

| Marker                                                        | Spec                                   |
| ------------------------------------------------------------- | -------------------------------------- |
| `E2E-040` — read-only credential refused a transition         | `pos-order-flow.http.spec.ts`          |
| `E2E-020/029` — credential without scope refused a stock push | `pos-catalogue-inventory.http.spec.ts` |
| `E2E-012` — valid credential lacking scope                    | `pos-onboarding.http.spec.ts`          |

They are **explained**, so this criterion passes. They are **not critical**: 401 in place of 403
grants no access and moves no money — it costs an integrator diagnostic clarity, not safety.

`it.failing` is self-announcing: each passes while the defect stands and turns the suite red the
day it is fixed, so none can rot into a stale marker. That is not theoretical — it is what forced
`E2E-008` to flip when the credential defect was corrected.

### What these markers are pinning: R6, ruled and unimplemented

R6 requires a valid credential lacking the required scope to receive **403**, an invalid or
unknown credential **401**, and the existing **404** preserved. Today
`CredentialsService.authenticateIncoming` returns `null` for every failure and the guard maps that
to 401, so all three cases are indistinguishable.

**That uniformity is deliberate, and the method says so** — it exists to stop a caller
distinguishing "no such integration" from "wrong key" and enumerating ids. Implementing R6 is
therefore a narrowing of a documented decision, not a straightforward bug fix, and the narrowing
is safe for a specific reason worth writing down: the 403 case is reachable **only after the
caller has proved possession of a valid credential for that integration**. At that point they
already know the integration exists and their key works, so the distinction leaks nothing. The
anti-enumeration property is preserved exactly where it matters — the unauthenticated cases stay
uniform.

R6 is recorded as ruled-and-unimplemented in
`DPX-MKT-INT-001-P1-POS-RULINGS-001.md`. Closing it is a contained change — a third outcome from
`authenticateIncoming`, the guard mapping it to 403, and three markers flipping to `it()` — but it
alters a security-response semantic on a live API and revises a documented deliberate decision, so
it wants its own increment rather than being folded into a gate assessment.

## 4 · Compatibility impact resolved ✅ — closed 2026-09-15

**P4 was run against production on 2026-09-15** by the founder acting as authorized operator,
through the Railway dashboard Console on the backend service. All six values returned `0`:

```
c1_http_webhooks            = 0     c3_out_of_vocabulary_scopes = 0
c2a_active_incoming_api_key = 0     c4_no_expiry                = 0
c2b_active_outgoing_api_key = 0     c5_legacy_short_lifetime    = 0
                                    as of 2026-09-15T13:23:26.969Z
```

**The compatibility impact is zero because there is nothing to be compatible with.** `c2a = 0`
means no live `INCOMING_API_KEY` exists in production. No credential predates the policy, none
carries an unrecognised scope, none lacks an expiry, and no `http://` webhook row exists.

This criterion is satisfied, and the basis should be stated precisely rather than flattened into
a tick: it is satisfied by an **empty population**, not by a population examined and found safe.
`E2E-017` still pins the compatibility guarantee in executable form for whenever credentials do
exist; this measurement says only that today there are none.

**A caveat worth carrying forward.** A merchant-facing integration with zero provisioned
credentials means no merchant is currently authenticated against the POS surface. Whether that is
expected at this stage is a product question, not a gate question, and it is deliberately not
answered here.

### The original blocker, kept for the record

P4 rules _inventory first, then decide the migration and expiry treatment of existing
credentials_. It is a decision to look before deciding, and until 2026-09-15 **the production
counts had never been run**:

1. existing `http://` webhook URLs
2. active `INCOMING_API_KEY` vs `OUTGOING_API_KEY`
3. credentials carrying scopes outside the six approved by R4
4. credentials with no `expiresAt`

What _is_ established:

- Pre-existing merchant-chosen `INCOMING_API_KEY` credentials still authenticate — pinned by
  `E2E-017`, which is the compatibility guarantee in executable form.
- The new policy (256-bit, `dpx_integration_` prefix, **99-year expiry** — 90-day until superseded
  on 2026-09-14 — explicit rotation) applies to newly issued credentials and does not
  retroactively touch stored ones. A one-time extension of the non-expired legacy population has
  since been ruled and built, but **not executed**: `ops/DPX-CREDENTIAL-LEGACY-EXTENSION-001.md`.

What is **not** established, and is exactly what the counts would settle: how many live
credentials predate the policy, how many carry scopes R4 does not recognise, and how many have no
expiry — and therefore what migrating them would actually affect.

Count 1 has since acquired a second consumer: PR #398 enforces HTTPS on every webhook write path
while grandfathering existing `http://` rows, and recorded that those rows must be migrated or
explicitly handled **before** webhook delivery is built. Two workstreams now wait on the same
four integers.

**This gate cannot pass until the inventory is taken.** The mechanism is already agreed: an
authorized operator runs four read-only `SELECT COUNT(*)` statements and returns four integers.
No credential hashes, plaintext secrets or merchant-identifying values are selected; no new
production code, no privileged endpoint, no Operations Console change, no deployment, no
migration.

## 5 · No unauthorized financial effect ✅

8E established the boundary structurally: POS-driven fulfilment emits only `OrderAccepted` and
`OrderReady`, while every financial subscriber listens on `OrderCompleted`, `OrderRefunded`,
`DeliveryCompleted`, `DeliveryCashConfirmed` and the ride events. The two sets are disjoint, and
the assertions snapshot `Wallet`, `WalletLedgerEntry`, `PaymentTransaction`, `OrderSettlement`,
the commission ledger and `MerchantSettlementTransfer` across a POS fulfilment to prove nothing
moves — including for `MERCHANT_DIRECT`, where DrippleX creates no platform-held payment leg at
all.

**Caveat, unchanged since 8E:** the disjointness is a property of the current event wiring, not a
thing anything _enforces_. A future subscriber added to an order event would silently cross the
boundary. The suite would catch it; no structural control would.

## 6 · Merchant can onboard with the credential DrippleX gives them ✅

This is the criterion the whole workstream existed to fix. `POST /integrations` generated a key
stored as `OUTGOING_API_KEY` (AES-256-GCM) while incoming authentication reads `INCOMING_API_KEY`
(bcrypt), so `bcrypt.compare` threw against ciphertext and was swallowed as a refusal: the
credential DrippleX handed a merchant could never authenticate. It had no test coverage, and the
simulator routed around it.

Corrected in PR #389, live in production, and proved end to end by the simulator running the real
lifecycle — obtain the credential the way a merchant does, then use it — **29 passed, 0 failed**.
`E2E-008` is the regression test and flipped from `it.failing` to `it()` the moment the fix
landed.

---

## What this gate is waiting for

| Blocker                        | Nature                         | Who can clear it                              |
| ------------------------------ | ------------------------------ | --------------------------------------------- |
| **The four production counts** | Read-only inventory, never run | An authorized operator; founder authorization |
| R6 / B6                        | Ruled, unimplemented           | Engineering — its own increment               |
| Rides/delivery spec flakiness  | Pre-existing, unrelated to POS | Engineering — its own increment               |

Only the first blocks this gate.
