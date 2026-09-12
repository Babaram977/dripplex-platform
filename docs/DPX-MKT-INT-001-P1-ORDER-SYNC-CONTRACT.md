# MKT-INT-001-L (inbound half) — POS order status sync: implementation contract

**Document**: DPX-MKT-INT-001-P1-ORDER-SYNC-CONTRACT.md
**Status**: Implemented. §5 **ruled and closed** (2026-09-12), with the caveat in §5.3 recorded. **Awaiting sign-off on §7**; §6 and §8 are open on purpose.
**Date**: 2026-09-12
**Extends**: `DPX-MKT-INT-001-P1-CATALOGUE-CONTRACT.md` (+ Amendment 1) and
`DPX-MKT-INT-001-P1-INVENTORY-CONTRACT.md`. Where any of them disagree with the approved
catalogue contract, the catalogue contract wins.

---

## 1. The one thing this document is really about

An order is money. Two of the transitions in `MerchantOrdersService` — `rejectOrder` and
`cancelOrder` — **refund the customer's wallet**, and `COMPLETED` is what releases a merchant
settlement. A POS credential is held by a third-party till.

So the boundary, stated once and enforced in four places:

> **A POS may drive exactly two transitions: `CONFIRMED → PREPARING` (accept) and
> `PREPARING → READY`. Nothing else. Ever.**

Enforced by:

1. the DTO (`@IsIn(POS_DRIVABLE_ORDER_STATUSES)`) — the request layer;
2. the service's own check, before anything is written — so a future internal caller, or a
   controller wired up wrong, cannot get past it either;
3. a `never` assignment in the transition switch — **the compiler** refuses to build if a third
   status is added to the drivable set without being handled;
4. a test that asserts the drivable list is _exactly_ `['PREPARING', 'READY']`, and a test that
   the wallet is never called by anything a POS can send.

The transition itself is **not implemented here**. `OrderStatusIngestionService` calls the very
same `MerchantOrdersService.acceptOrder` / `markReady` that the merchant's own portal button
calls. A second order state machine inside the integrations module would be a second opinion
about when a customer gets their money back.

---

## 2. Correction: the backlog names a state machine DrippleX does not have

Ticket L specifies `CREATED, PAYMENT_CONFIRMED, ACCEPTED, PREPARING, READY, PICKED_UP,
DELIVERED, COMPLETED, CANCELLED`, with POS transitions `RECEIVED → ACCEPTED → PREPARING →
READY`.

The actual `OrderStatus` enum is `DRAFT PENDING CONFIRMED PREPARING READY DRIVER_ASSIGNED
PICKED_UP IN_TRANSIT DELIVERED COMPLETED CANCELLED REFUNDED DISPUTED FAILED`. There is no
`RECEIVED`, no `ACCEPTED` and no `PAYMENT_CONFIRMED` status — accepting an order _is_ the
transition `CONFIRMED → PREPARING`.

**Ruled the same way catalogue Amendment 1 ruled it:** use the vocabulary the schema already
established. A POS sends `PREPARING` to accept and `READY` when the food is up.

The backlog's preconditions are already enforced, by the merchant service rather than by
anything written here: `acceptOrder` requires `CONFIRMED`, `markReady` requires `PREPARING`.
A failed precondition is surfaced as **409**, which is what the backlog asked for.

---

## 3. Routes

All three are POS-facing and authenticate with an integration credential. There is no
merchant-facing route on this controller: a merchant reads their own orders in the portal,
which shows them everything, while these responses are narrowed to what a third party may see.

| Method | Path                                               | Scope          |
| ------ | -------------------------------------------------- | -------------- |
| `PUT`  | `/api/v1/integrations/orders/status/:orderNumber`  | `orders:write` |
| `GET`  | `/api/v1/integrations/orders/detail/:orderNumber`  | `orders:read`  |
| `GET`  | `/api/v1/integrations/orders/list?page=&pageSize=` | `orders:read`  |

**Every path leads with a literal segment, and that is load-bearing.** The first draft used
`GET /api/v1/integrations/orders`, which `pos-route-reachability.spec.ts` proved was swallowed
by **two** earlier routes — `GET /integrations/:integrationId` (`IntegrationsCController`) and
`GET /integrations/:id` (the legacy controller). It would have shipped answering 401 from a
CRUD route while looking alive, the same defect that made the stock push unreachable. Two
literal segments cannot be claimed by a one-segment parameter, and giving all three routes the
same shape means none can shadow another whatever order anything is declared in.

`orders:read` and `orders:write` are already in the documented set on
`IntegrationCredential.scopes` and already granted by default, so no credential is reissued.
Reading orders is deliberately not enough to move them.

**Order identity.** The order is named by its **DrippleX order number**, in the path. There is
no external-order-id ↔ order mapping table, and resolving on an opaque third-party string
would mean inventing one. The POS's own reference travels in the body, is recorded on
`OrderStatusUpdate.externalOrderId` for reconciliation, and is never used to resolve anything.

---

## 4. Behaviour

| Case                                          | Behaviour                                                                                                                                                                                                                                                                                            |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PREPARING` on a `CONFIRMED` order            | `MerchantOrdersService.acceptOrder` — notifications and domain events included                                                                                                                                                                                                                       |
| `READY` on a `PREPARING` order                | `MerchantOrdersService.markReady`                                                                                                                                                                                                                                                                    |
| Status the order already has                  | nothing moves, `alreadyInStatus: true`, **not** a conflict                                                                                                                                                                                                                                           |
| Precondition not met                          | **409**, `reconciliationStatus = CONFLICT`, one `ORDER_STATE_MISMATCH` conflict raised                                                                                                                                                                                                               |
| Any other status                              | **422** before anything is written — no claimed key, no conflict row                                                                                                                                                                                                                                 |
| Order belongs to another merchant             | **404**, identical to "no such order"                                                                                                                                                                                                                                                                |
| Unknown order number                          | **404**, recorded in `IntegrationLog` only                                                                                                                                                                                                                                                           |
| `Idempotency-Key` missing or > 100 chars      | **400**                                                                                                                                                                                                                                                                                              |
| Replay of an `ACCEPTED` key                   | the recorded outcome, `replayed: true`; nothing re-runs                                                                                                                                                                                                                                              |
| Replay of a `CONFLICT` key                    | the same 409 — one key, one outcome                                                                                                                                                                                                                                                                  |
| Replay of a `PENDING` key                     | waits up to 1s for the claim to settle; then **asks the order**. Order already at the requested status ⇒ the transition committed, so the row settles ACCEPTED and the caller is told it succeeded. Order not there ⇒ **409 "did not complete"**. Never a guessed success, and never a false failure |
| Integration whose user has no MerchantProfile | 500 and a logged error — a DrippleX defect, not a bad payload                                                                                                                                                                                                                                        |

**Why a missing order is 404 and not 403.** Distinguishing "not yours" from "does not exist"
would let anyone holding one integration key enumerate which order numbers exist across the
platform. The same reasoning the credential guard already uses for integration ids.

**Why an unknown order writes no `OrderStatusUpdate` row.** The idempotency key is
caller-supplied. Recording a row for an order that does not exist would let a POS write into
the reconciliation table at will.

**Idempotency and recovery.** The insert of the `OrderStatusUpdate` row _is_ the claim; the
unique index on `(integrationId, idempotencyKey)` is the guarantee. A process that dies between
claiming and transitioning leaves the row `PENDING` — visibly unresolved rather than falsely
complete. A retry under a **new** key is safe, because the order's own preconditions stop
anything being applied twice, and because a POS reporting a status the order already holds is
treated as already-applied rather than as a conflict.

**An unsettled claim is not a failed transition either, and that one was a correctness
blocker.** The claim, the transition and the settle are three statements. A process that dies
after the transition but before the settle leaves a `PENDING` row above a business change that
already happened — and the first implementation answered a same-key retry with
"a previous attempt with this idempotency key did not complete", about an order that was at
that moment `PREPARING`.

That is a **false terminal failure**, and it sat on the likely path rather than the unlikely
one: an idempotency key is exactly what a client reuses when a request times out, so the
retrying POS would have kept receiving it while the kitchen cooked. A fresh key self-healed via
`alreadyInStatus`; the same key never did.

`fromRecord` now performs the fresh evaluation the state deserves. When the row is still
`PENDING` after the wait, it re-reads the **order** — not the copy `applyStatus` took before
the transition, which is precisely the read that cannot answer the question. If the order
already holds the status the claim asked for, the transition demonstrably committed: the row
is settled `ACCEPTED` and the caller is told the truth. Only when the order does not hold it is
"outcome unknown" honest, and only then is the 409 raised.

Both branches are pinned by deterministic tests — `an interrupted settle over a transition that
DID happen reports success` and `an interrupted claim replays as unresolved, never as success` —
and by a mutation that removes the reconciliation.

**A racing duplicate is not an abandoned claim, and the first draft could not tell them apart.**
Claiming the key and finishing the transition are two steps, so two identical pushes in flight
at once meant the loser read the winner's row while it was still `PENDING` and answered
"a previous attempt with this idempotency key did not complete" — about an attempt that was
completing as it read. An error handed to a POS that had done nothing but retry.

The concurrency test caught it, but only sometimes: measured over ten runs it was **5 green,
5 red — a coin flip**, and the very first run of that test happened to land green, which is
exactly how a race hides. A replay of a `PENDING` row now waits up to one second (ten checks at
100ms) for the claim to settle and returns the settled outcome. Past that budget the claim
really is abandoned, and the message finally means what it says. Re-measured with the wait in
place: **10 green out of 10**.

---

## 5. What a POS may see — **RULED, 2026-09-12. Closed.**

`PosOrderView` is an **allow-list**, and the test pins the exact key set by equality, so a
field added to `Order` tomorrow is invisible here until somebody decides on purpose that a
third-party POS may see it.

### 5.1 The three judgement calls, as ruled

| Field           | Ruling                    | Reason given                                                                                                                                                                    |
| --------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `paymentStatus` | ✅ **APPROVED**, narrowly | The merchant needs to know whether the order is paid or awaiting payment in order to fulfil it. It is a limited state — not credentials, method, transaction data or reference. |
| `notes`         | ❌ **NOT EXPOSED**        | Customer-controlled free text, and therefore the largest uncontrolled privacy and data-exposure surface in the payload. Not sent to a third-party POS in P1.                    |
| `deliveryFee`   | ❌ **NOT EXPOSED**        | DrippleX's delivery charge and revenue component, not required by the merchant's fulfilment workflow.                                                                           |

**On `paymentStatus`, the narrowness is the ruling.** It is an order-level state and nothing
more. The POS must never receive the payment provider, transaction or reference ids, card or
bank details, wallet information, or payment metadata. Asserted by
`paymentStatus is an order-level state and nothing more`, which checks the value is a member of
the `PaymentStatus` enum and that no provider, transaction, reference, card, bank, wallet,
method or authorization string appears anywhere in the serialised payload.

**On `notes`, a replacement is the right route, not an exception.** If the business needs a
kitchen instruction, that is a deliberate merchant-visible field with its own sanitisation and
privacy rules — not an arbitrary customer text column exported to a third party because it
happens to exist.

### 5.2 The final P1 allow-list

**Included:** `orderNumber`, `status`, `paymentStatus`, `fulfillmentType`, `currency`,
`subtotal`, `discount`, `tax`, `total`, `placedAt`, `estimatedReadyAt`, `readyAt`, and per item
`name`, `quantity`, `unitPrice`, `subtotal`, `externalSku`.

**Excluded:** customer identity of every kind (id, name, phone, email), delivery address,
payment method, payment transactions, delivery jobs, driver information, coupon code, cart id,
the DrippleX internal order id, **`deliveryFee`**, **`notes`**, and every ride field.

### 5.3 Caveat recorded against 5.1 — **the delivery fee stays derivable**

Withholding the field does not withhold the number. `total` is exposed and so are `subtotal`,
`discount` and `tax`, and

```
total − (subtotal − discount + tax) = deliveryFee
```

exactly. A POS that wants DrippleX's per-order delivery revenue can compute it in one
subtraction.

This is recorded rather than quietly accepted or quietly fixed, because closing it means
choosing, and the choice is a product decision:

| Option                                                       | Cost                                                                                                                                                                       |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Leave as ruled                                               | The exclusion is presentational; the economics are one subtraction away.                                                                                                   |
| Also withhold `total`                                        | The POS cannot show the customer's order value at all. `total` was explicitly in the allow-list.                                                                           |
| Report a merchant-scoped total (`subtotal − discount + tax`) | Arithmetic reconciles and no DrippleX economics leak — but a field named `total` would no longer be what the customer paid, which is its own way to mislead an integrator. |

Implemented as ruled (option 1). **No decision is required to ship**; this is flagged so the
gap is a known one rather than a discovered one.

---

## 6. Not built, and why — **decision required**

**POS-originated order creation is not implemented and has no approved contract anywhere.**

There is no ticket for it in the backlog, and nothing in the catalogue or inventory contracts
covers it. Creating a DrippleX order from a POS payload would mean deciding, in code, what a
customer is charged — pricing, discounts, tax, delivery fee, commission and settlement all
follow from the order row. Writing that without a founder decision would be exactly the
speculative behaviour the engineering playbook forbids.

`OrderStatusUpdate.internalOrderId` is nullable and `reconciliationStatus` has a `PENDING`
value the schema documents as "awaiting order creation", so the schema anticipates it. Nothing
today produces that state, and this increment does not invent one.

**What would need deciding first:** whether a POS-created order is a DrippleX order at all,
who the customer is on it, whether it is priced by DrippleX or accepted as priced, whether it
settles, and whether it earns commission.

Also not built (outbound half of ticket L, tracked separately): the DrippleX → POS webhook —
event envelope, HMAC-SHA256 signature, retries with backoff, delivery log, and the
`webhook-test` route.

---

## 7. Divergences from the ticket L backlog entry — **sign-off requested**

| #   | Backlog said                                                                               | Built                             | Why                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/api/integrations/{integrationId}/orders/...`                                             | no `{integrationId}` in the path  | The credential already identifies the integration; a path id is a second authorization surface to cross-check. Same as catalogue and inventory. |
| 2   | POS transitions `RECEIVED → ACCEPTED → PREPARING → READY`                                  | `PREPARING` and `READY`           | §2 — the other names do not exist in `OrderStatus`.                                                                                             |
| 3   | Resolve by `{externalOrderId}`                                                             | resolve by DrippleX `orderNumber` | §3 — no mapping table exists, and inventing a resolution rule from an opaque third-party string is how one POS moves another's order.           |
| 4   | Async job queue for status updates                                                         | synchronous                       | There is no queue. The transition is finished when the response is written.                                                                     |
| 5   | Order fulfilment webhook, retries, `webhook-test`                                          | not in this increment             | §6 — the outbound half is its own piece of work with its own failure modes.                                                                     |
| 6   | "IntegrationLog can include webhook_delivery_status **or** new table `webhook_deliveries`" | neither yet                       | That is a schema decision for the outbound increment, not a side effect of this one.                                                            |

---

## 8. Open questions — **decisions required**

1. **Audit attribution.** `MerchantOrdersService` sets the audit actor itself, to the merchant's
   user id, so an order's own audit trail records a POS-driven accept as if the merchant tapped
   the button. The integration is named in the record's user agent (`integration:<id>`) and the
   full story is in `OrderStatusUpdate`, but the order audit row itself is not literally
   accurate. Changing it means changing a live merchant path.
2. **Rate limiting.** None of the three routes is throttled, and neither are the catalogue or
   inventory routes. A POS is a different shape of caller from a person; it needs its own number.
3. **`estimatedReadyAt`.** `acceptOrder` accepts one and the POS cannot send it, so an
   integration-accepted order never carries an ETA the customer can see. Adding it is small;
   whether a POS's estimate should reach a customer is not a code decision.
4. **Delay.** `MerchantOrdersService.delayOrder` exists and is not exposed. A kitchen running
   late is exactly the thing a POS knows first.

---

## 9. Verification

Every guard was removed one at a time and the suite confirmed to go red. A green suite is not
evidence.

| Mutation                                                | Result                         |
| ------------------------------------------------------- | ------------------------------ |
| `CANCELLED` added to the POS-drivable set               | 🔴 4 failed                    |
| Order lookup drops the merchant-ownership predicate     | 🔴 3 failed                    |
| P2002 replay recovery on the claim removed              | 🔴 4 failed                    |
| A replayed `CONFLICT` reported as success               | 🔴 1 failed                    |
| A replayed `PENDING` reported as success                | 🔴 1 failed                    |
| Precondition failure settled as `ACCEPTED`              | 🔴 1 failed                    |
| Precondition failure swallowed                          | 🔴 1 failed                    |
| `ORDER_STATE_MISMATCH` no longer raised                 | 🔴 2 failed                    |
| POS view leaks `customerId`                             | 🔴 1 failed                    |
| **Customer `notes` put back in the POS view**           | 🔴 2 failed                    |
| **`deliveryFee` put back in the POS view**              | 🔴 2 failed                    |
| **`paymentStatus` widened to carry the payment method** | 🔴 1 failed                    |
| SKU lookup ignores the integration                      | 🔴 1 failed                    |
| Already-in-status short circuit removed                 | 🔴 1 failed                    |
| Page size no longer capped                              | 🔴 2 failed                    |
| Unknown order no longer logged                          | 🔴 1 failed                    |
| `READY` routed to `acceptOrder`                         | 🔴 3 failed                    |
| Service-level drivable-status check removed             | 🔴 1 failed                    |
| Status route asks for the read scope instead of write   | 🔴 1 failed                    |
| List route restored to the shadowed bare path           | 🔴 1 failed                    |
| Detail route given a leading parameter                  | 🔴 2 failed                    |
| Order-state reconciliation removed from the replay path | 🔴 1 failed                    |
| Replay settle-wait removed (`attempt < 0`)              | 🔴 **5 of 10 runs** — see note |

Twenty-three mutations. Twenty-two are deterministic and every one of them is red; the three in
bold are the §5 rulings, so those decisions are enforced rather than merely recorded.

**The twenty-second is reported honestly as non-deterministic.** Removing the replay
settle-wait fails 5 runs in 10, because the defect it guards is a race and a race does not fail
on command. That is the measurement, not a clean red: `5/10 red` without the guard against
`10/10 green` with it. Quoting it as "red" alongside the others would overstate it.

The compiler-enforced exhaustiveness check (the `never` assignment in the transition switch) is
not in this table on purpose: it is a build-time guarantee, not a test, and reporting it as a
passing mutation would overstate what was measured.

### End to end, over real HTTP

No unit test can show a route is reachable — that is what the shadowing defect proved twice.
The whole path was driven against a locally running API: credential headers, guard, scope
check, service, database, response.

| Check                                                       | Result                                         |
| ----------------------------------------------------------- | ---------------------------------------------- |
| Detail and list routes reachable and authorised             | 200, 200                                       |
| The old bare list path is not this controller               | 401 "Authentication required" (the CRUD route) |
| The view carries exactly the ruled key set                  | 13 keys, matched                               |
| Customer note does not cross the wire (detail **and** list) | absent                                         |
| `deliveryFee` — neither field nor value on the wire         | absent                                         |
| No customer identity on the wire                            | absent                                         |
| `paymentStatus` is a bare state, no payment detail anywhere | `PAID`                                         |
| An `orders:read`-only credential cannot move an order       | 401                                            |
| An authorised push moves the order                          | CONFIRMED → PREPARING                          |
| Replaying the key re-runs nothing                           | `replayed: true`, status unchanged             |
| A POS requesting `CANCELLED`                                | 400, order not cancelled                       |
| A push without `Idempotency-Key`                            | 400                                            |
| Another merchant's order                                    | 404                                            |

Twenty assertions, twenty passed.

**Full backend suite: 3113 passed / 297 suites** against a fresh, never-seeded database with
`CI=true`. `tsc` and `eslint` clean. No schema change; `prisma migrate diff` reports no
difference.

---

**Related:** `docs/DPX-MKT-INT-001-IMPLEMENTATION-BACKLOG.md` (ticket L) ·
`docs/DPX-MKT-INT-001-P1-CATALOGUE-CONTRACT.md` ·
`docs/DPX-MKT-INT-001-P1-INVENTORY-CONTRACT.md` ·
`docs/DPX-MERCHANT-003-INCOMING-ORDERS.md` · `docs/DPX-MERCHANT-011-ORDER-LIFECYCLE-E2E.md`
