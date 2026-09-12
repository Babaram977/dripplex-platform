# MKT-INT-001-L (inbound half) — POS order status sync: implementation contract

**Document**: DPX-MKT-INT-001-P1-ORDER-SYNC-CONTRACT.md
**Status**: Implemented, **awaiting founder / architecture sign-off on §5, §6 and §7**
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

| Method | Path                                              | Scope          |
| ------ | ------------------------------------------------- | -------------- |
| `PUT`  | `/api/v1/integrations/orders/:orderNumber/status` | `orders:write` |
| `GET`  | `/api/v1/integrations/orders/:orderNumber`        | `orders:read`  |
| `GET`  | `/api/v1/integrations/orders?page=&pageSize=`     | `orders:read`  |

`orders:read` and `orders:write` are already in the documented set on
`IntegrationCredential.scopes` and already granted by default, so no credential is reissued.
Reading orders is deliberately not enough to move them.

**Order identity.** The order is named by its **DrippleX order number**, in the path. There is
no external-order-id ↔ order mapping table, and resolving on an opaque third-party string
would mean inventing one. The POS's own reference travels in the body, is recorded on
`OrderStatusUpdate.externalOrderId` for reconciliation, and is never used to resolve anything.

---

## 4. Behaviour

| Case                                          | Behaviour                                                                              |
| --------------------------------------------- | -------------------------------------------------------------------------------------- |
| `PREPARING` on a `CONFIRMED` order            | `MerchantOrdersService.acceptOrder` — notifications and domain events included         |
| `READY` on a `PREPARING` order                | `MerchantOrdersService.markReady`                                                      |
| Status the order already has                  | nothing moves, `alreadyInStatus: true`, **not** a conflict                             |
| Precondition not met                          | **409**, `reconciliationStatus = CONFLICT`, one `ORDER_STATE_MISMATCH` conflict raised |
| Any other status                              | **422** before anything is written — no claimed key, no conflict row                   |
| Order belongs to another merchant             | **404**, identical to "no such order"                                                  |
| Unknown order number                          | **404**, recorded in `IntegrationLog` only                                             |
| `Idempotency-Key` missing or > 100 chars      | **400**                                                                                |
| Replay of an `ACCEPTED` key                   | the recorded outcome, `replayed: true`; nothing re-runs                                |
| Replay of a `CONFLICT` key                    | the same 409 — one key, one outcome                                                    |
| Replay of a `PENDING` key                     | **409 "did not complete"** — never a guessed success                                   |
| Integration whose user has no MerchantProfile | 500 and a logged error — a DrippleX defect, not a bad payload                          |

**Why a missing order is 404 and not 403.** Distinguishing "not yours" from "does not exist"
would let anyone holding one integration key enumerate which order numbers exist across the
platform. The same reasoning the credential guard already uses for integration ids.

**Why an unknown order writes no `OrderStatusUpdate` row.** The idempotency key is
caller-supplied. Recording a row for an order that does not exist would let a POS write into
the reconciliation table at will.

**Idempotency and recovery.** The insert of the `OrderStatusUpdate` row _is_ the claim; the
unique index on `(integrationId, idempotencyKey)` is the guarantee. A process that dies between
claiming and transitioning leaves the row `PENDING` — visibly unresolved rather than falsely
complete. A replay of that key answers 409; a retry under a **new** key is safe, because the
order's own preconditions stop anything being applied twice, and because a POS reporting a
status the order already holds is treated as already-applied rather than as a conflict.

---

## 5. What a POS may see — **sign-off requested**

`PosOrderView` is an **allow-list**, and the test pins the exact key set, so a field added to
`Order` tomorrow is invisible here until somebody decides on purpose that a third-party POS may
see it.

**Included:** `orderNumber`, `status`, `paymentStatus`, `fulfillmentType`, `currency`,
`subtotal`, `discount`, `tax`, `deliveryFee`, `total`, `notes`, `placedAt`, `estimatedReadyAt`,
`readyAt`, and per item `name`, `quantity`, `unitPrice`, `subtotal`, `externalSku`.

**Excluded:** the DrippleX order id, customer id and any customer identity, delivery address,
payment method, payment transactions, coupon code, cart id, delivery jobs, driver, and every
ride field.

Three of the inclusions are judgement calls, and are flagged rather than assumed:

| Field           | Why it is in                                                                                                                           | The objection                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `paymentStatus` | A counter needs to know whether to hand the goods over. It is a state, not a payment detail — no method, no transaction, no reference. | It is still information about money reaching a third-party system.    |
| `notes`         | It is the customer's instruction to the kitchen; withholding it defeats the point of the integration.                                  | A customer may type anything into it, including personal information. |
| `deliveryFee`   | Included so `subtotal − discount + tax + deliveryFee = total` reconciles on a printed receipt.                                         | The delivery fee is DrippleX's revenue, not the merchant's.           |

**No customer identity is exposed at all** — not name, not phone, not email. A kitchen matches
on the order number. If a pickup counter genuinely needs a first name, that is a deliberate
NDPR decision and needs approval, not a quiet addition.

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

| Mutation                                              | Result      |
| ----------------------------------------------------- | ----------- |
| `CANCELLED` added to the POS-drivable set             | 🔴 3 failed |
| Order lookup drops the merchant-ownership predicate   | 🔴 2 failed |
| P2002 replay recovery on the claim removed            | 🔴 4 failed |
| A replayed `CONFLICT` reported as success             | 🔴 1 failed |
| A replayed `PENDING` reported as success              | 🔴 1 failed |
| Precondition failure settled as `ACCEPTED`            | 🔴 2 failed |
| Precondition failure swallowed                        | 🔴 2 failed |
| `ORDER_STATE_MISMATCH` no longer raised               | 🔴 1 failed |
| POS view leaks `customerId`                           | 🔴 1 failed |
| SKU lookup ignores the integration                    | 🔴 1 failed |
| Already-in-status short circuit removed               | 🔴 1 failed |
| Page size no longer capped                            | 🔴 1 failed |
| Unknown order no longer logged                        | 🔴 1 failed |
| `READY` routed to `acceptOrder`                       | 🔴 4 failed |
| Service-level drivable-status check removed           | 🔴 1 failed |
| Status route asks for the read scope instead of write | 🔴 1 failed |

The compiler-enforced exhaustiveness check (the `never` assignment) is not in this table on
purpose: it is a build-time guarantee, not a test, and reporting it as a passing mutation would
overstate what was measured.

No schema change; `prisma migrate diff` reports no difference.

---

**Related:** `docs/DPX-MKT-INT-001-IMPLEMENTATION-BACKLOG.md` (ticket L) ·
`docs/DPX-MKT-INT-001-P1-CATALOGUE-CONTRACT.md` ·
`docs/DPX-MKT-INT-001-P1-INVENTORY-CONTRACT.md` ·
`docs/DPX-MERCHANT-003-INCOMING-ORDERS.md` · `docs/DPX-MERCHANT-011-ORDER-LIFECYCLE-E2E.md`
