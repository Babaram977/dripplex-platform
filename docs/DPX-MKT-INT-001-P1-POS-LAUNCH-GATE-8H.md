# DPX-MKT-INT-001-P1-POS-LAUNCH-GATE-8H — the POS production-readiness gate

**Assessed:** 2026-09-14
**Against:** `main` @ `924e2ae4`, backend deployment `60fdf316`
**Nature:** 8H is a gate, not an implementation unit. It reads the other seven and reports
whether the POS integration is ready to be called production-ready.

---

## Verdict

**Five of six criteria pass. One does not.**

The one that fails is **not** blocked on engineering. It is blocked on a read-only production
inventory that has been deliberately gated since the audit and has never been run. Every other
criterion is satisfied with evidence in the repository.

| #   | Criterion                                                    | Verdict                                          |
| --- | ------------------------------------------------------------ | ------------------------------------------------ |
| 1   | All required HTTP journeys green                             | ✅                                               |
| 2   | DB assertions actually executed                              | ✅                                               |
| 3   | No critical expected-to-fail item left unexplained           | ✅ (three markers, all explained, none critical) |
| 4   | **Compatibility impact resolved**                            | ❌ **blocked — see §4**                          |
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

## 4 · Compatibility impact resolved ❌ — the blocker

**P4 is open, and it cannot be closed from inside the repository.**

P4 rules _inventory first, then decide the migration and expiry treatment of existing
credentials_. It is a decision to look before deciding, and **the four production counts have
never been run**:

1. existing `http://` webhook URLs
2. active `INCOMING_API_KEY` vs `OUTGOING_API_KEY`
3. credentials carrying scopes outside the six approved by R4
4. credentials with no `expiresAt`

What _is_ established:

- Pre-existing merchant-chosen `INCOMING_API_KEY` credentials still authenticate — pinned by
  `E2E-017`, which is the compatibility guarantee in executable form.
- The new policy (256-bit, `dpx_integration_` prefix, 90-day expiry, explicit rotation) applies to
  newly issued credentials and does not retroactively touch stored ones.

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
