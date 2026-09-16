# DPX-ORDER-8D-C · potentially stranded CONFIRMED orders — measurement runbook

**Threshold ruled 2026-09-15: 30 minutes.** Statement schema-verified and fixture-tested.
**Executed against production 2026-09-15 — `s1 = 1`. See §0.**

---

## 0 · Production result — 2026-09-15

Run by the founder as authorized operator in the production backend container.
Screenshot-verified from the console output.

```
s1_potentially_stranded_confirmed = 1     as of 2026-09-15T13:28:38.627Z
threshold in force                = 30 minutes
```

### Read this carefully

**One order, and the word that matters is _potentially_.** Per §4, the database cannot distinguish
an order the POS failed to advance from one the merchant simply never accepted — both present
identically as `CONFIRMED` + `DELIVERY` + no `DeliveryJob` past the threshold.

**This is not evidence of a POS or integration defect,** and it must not be reported as the impact
of one. That reading is specifically ruled out, and the P4 result taken in the same session makes
it less likely rather than more: with **no integration credentials in production at all**, no POS
was authenticated to advance this order in the first place. Merchant inaction is the more
economical explanation, but the measurement does not establish that either.

### It does not bear on P4

8D-C is a separate measurement with its own ruling. `s1 = 1` neither advances nor blocks the P4
credential/integration inventory gate, which is answered by step A alone.

### What it does mean

Per §5, a stranded `CONFIRMED` order holds its inventory reservation **indefinitely** — the
cleanup sweep only releases `PENDING` orders. So this one order is holding stock, not merely
customer patience. At n=1 that is a small cost; the finding is recorded because the mechanism
scales with the number, not because one order is an incident.

### Nothing was done to it

No cancellation, no inventory release, no status mutation, no remediation. **Remediation remains
an undecided separate ruling** (§7), and a measured population does not authorize acting on it.

### Backlog sweep — the pre-fix baseline, 2026-09-16

Run in the production backend container after #414 deployed at **2026-09-16T00:23:59Z**, so that
this is a clean measurement of the population that existed _before_ the fix.
Screenshot-verified.

```
groups: 1
  fulfillment_type=DELIVERY  payment_method=CASH  payment_status=PENDING
  orders=1  ge_30_min=1  ge_24_hours=1  before_fix=1  after_fix=0
  oldest = newest = 2026-09-11T16:26:16Z
as of 2026-09-16T01:37:18.504Z | #414 deploy boundary 2026-09-16T00:23:59Z
```

**`groups: 1` is the whole story, and it is broader than one stranded order.** The sweep filtered
on `status = 'CONFIRMED'` and nothing else — every fulfilment type, every payment method. One row
came back. So this is not one stranded order among many: it is the **entire `CONFIRMED`
population in production**. There were no `PICKUP` rows to exclude and no gateway or wallet rows
to distinguish.

|                                               |                                            |
| --------------------------------------------- | ------------------------------------------ |
| **8D-C population**                           | **1** — `DELIVERY` + `CONFIRMED` + ≥30 min |
| Also beyond the 24 h order-completion horizon | yes                                        |
| Predates #414                                 | yes — `before_fix = 1`, `after_fix = 0`    |
| Age at measurement                            | ~4 d 9 h 11 m                              |

It is the same order the single-order diagnostic returned (`DPX-20260911-F7GK1S`), and the same
one 8D-C counted at 2026-09-15T13:28:38Z. **It has not moved in the ~12 hours between the two
measurements** — the merchant still has not acted on it. It remains recoverable: `acceptOrder`
guards only on `status === CONFIRMED` and has no age limit.

#### `after_fix = 0` is a baseline, not evidence the fix works

It means no order was confirmed in the ~73 minutes between the deploy and the measurement. It
cannot distinguish _"the fix works"_ from _"nothing has exercised it"_. **`ORDER_ACTIONABLE`
remains behaviourally unproven in production** until a genuine CASH order arrives — the code path
is deployed and verified, the behaviour is not.

#### What this sweep cannot answer

It filtered `CONFIRMED` only, so it says **nothing about overall order volume**. A `CONFIRMED`
population of one is equally consistent with low traffic and with orders moving promptly through
to later statuses. That matters for how much weight `after_fix = 0` can carry, and a status
histogram would settle it. Not inferred here.

#### Cause is still not attributed

`CASH` + `PENDING` is **consistent with** the notification defect #414 fixed. It is not proof of
it: a merchant who saw the order and did not act produces an identical row. Per §4 that
distinction is not available from the data, and this measurement does not close it.

**No remediation is authorised by this count.** Nothing was cancelled, advanced, refunded or
released.

---

### Next step — inspect the one order (read-only, NOT yet run)

Founder sequence, 2026-09-15: understand the single order **before** any remediation ruling. This
statement is prepared and locally verified; it has **not** been run against production.

Run in the production backend container, single-quoted, same mechanism as the measurement:

```sql
SELECT
  o.order_number, o.status, o.payment_status, o.payment_method, o.fulfillment_type,
  round(extract(epoch FROM (now() - COALESCE(o.confirmed_at, o.created_at)))/60) AS minutes_waiting,
  o.created_at, o.confirmed_at, o.currency, o.total,
  (SELECT count(*) FROM order_items oi WHERE oi.order_id = o.id)   AS item_count,
  o.merchant_id,
  (SELECT count(*) FROM merchant_integrations mi WHERE mi.merchant_id = o.merchant_id) AS merchant_integration_rows,
  (SELECT count(*) FROM delivery_jobs dj WHERE dj.order_id = o.id) AS delivery_jobs
FROM orders o
WHERE o.status = 'CONFIRMED'
  AND o.fulfillment_type = 'DELIVERY'
  AND COALESCE(o.confirmed_at, o.created_at) < now() - interval '30 minutes'
  AND NOT EXISTS (SELECT 1 FROM delivery_jobs dj WHERE dj.order_id = o.id)
ORDER BY COALESCE(o.confirmed_at, o.created_at) ASC;
```

**Read-only. No customer-identifying value is selected** — no name, phone, email or delivery
address. `order_number` and `merchant_id` are returned because remediation cannot be discussed
without knowing which order and which merchant; if even that is too much, drop `merchant_id` and
the diagnosis narrows accordingly.

| Founder's question                  | Answered by                                                                                                                                                                 |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| order age                           | `minutes_waiting`, `created_at`, `confirmed_at`                                                                                                                             |
| fulfilment / payment context        | `payment_status`, `payment_method`, `fulfillment_type`, `total`, `item_count`                                                                                               |
| merchant / integration relationship | `merchant_id`, `merchant_integration_rows`                                                                                                                                  |
| why no `DeliveryJob` exists         | **already answered from the code** — see the correction below. The order never reached `READY`, so none was ever created. `delivery_jobs` is returned only to confirm that. |
| real customer-facing failure?       | Needs `minutes_waiting` **and** `payment_status` together — see below                                                                                                       |
| recoverable?                        | `status = CONFIRMED` and `cancelled_at IS NULL` mean the merchant can still accept it                                                                                       |

**The reading to watch for.** `payment_method = MERCHANT_DIRECT` with `payment_status = PENDING`
is the known stranding class recorded at `merchant-orders.service.ts:177` — a bank-transfer order
the merchant must confirm before it can progress. If that is what this order is, the cause is a
documented gap with a known handling path, not a new defect. Any other combination points at
merchant inaction or a notification failure.

**Nothing in this statement mutates anything**, and running it does not authorize remediation —
that ruling comes after, per §7.

### ⚠️ Correction to this document's own reasoning — what `s1` actually measures

Established from the code on 2026-09-15, while preparing the single-order investigation. **This
corrects §2's justification for one of the clauses, and it sharpens §4's attribution.**

A `DeliveryJob` is created from exactly **one** trigger: the `ORDER_READY` domain event.

| Path                                                             | Guard                                                                   |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `markReady` (`merchant-orders.service.ts:140`)                   | requires `status === PREPARING`, sets `READY`, then emits `ORDER_READY` |
| `confirmPaymentReceived` re-emit (`:252`)                        | guarded on `order.status === READY`                                     |
| `OrderReadySubscriber` (`delivery/order-ready.subscriber.ts:38`) | the only caller of `createDeliveryJob`                                  |

`CONFIRMED` precedes `PREPARING`, which precedes `READY`. So **a `CONFIRMED` order cannot have a
`DeliveryJob`** — not "usually doesn't", but cannot, structurally.

**Therefore `NOT EXISTS (delivery_jobs …)` is non-discriminating when combined with
`status = 'CONFIRMED'`.** It is always true. The count is correct, but the clause contributes
nothing, and §2's description of it — _"A job means dispatch happened"_ — describes a state this
predicate can never encounter.

Fixture **A-4** (§3) inserted a `delivery_job` against a `CONFIRMED` order and confirmed it was
excluded. That fixture constructed a state **the application cannot produce**, so it validated a
defensive clause rather than a real discriminator. It is left in place — the clause is harmless and
guards against a future second dispatch trigger — but it should not be read as evidence the
measurement distinguishes dispatched from undispatched orders at this stage.

**What the statement measures, stated accurately:**

> `DELIVERY` orders that have sat in `CONFIRMED` for 30+ minutes — that is, **the merchant has not
> accepted them.** Accepting moves an order to `PREPARING`, which this predicate excludes.

### This makes attribution sharper, not vaguer

§4 says the data cannot distinguish a POS failure from merchant inaction. That hedge was too
cautious. **At `CONFIRMED`, no dispatch has been attempted at all**, so a dispatch or POS failure is
not in the candidate set. The remaining explanations are:

- the merchant has not acted on the order, or
- the merchant never saw it (notification, device, or store-state problem).

The P4 result taken in the same session reinforces this: with **zero integration credentials in
production**, no POS was authenticated to advance this order in the first place.

So `s1 = 1` should be read as **one order awaiting merchant acceptance for over 30 minutes**, and
the investigation belongs on the merchant side. It remains _potentially_ stranded — a merchant
about to accept at minute 31 is not a failure — and it is still not evidence of a defect.

### It is an as-of value that moves both ways

Unlike `c5`, `s1` can rise as well as fall — orders enter and leave this population continuously
as merchants act on them. `s1 = 1` describes 2026-09-15T13:28:38Z and nothing else. Do not carry
it forward as a standing figure.

---

---

## 1 · The ruling

> **8D-C — Potentially Stranded CONFIRMED Order Threshold: 30 minutes.**
>
> A `CONFIRMED` order that remains unactioned for 30 minutes is considered **potentially
> stranded** and becomes eligible for measurement/remediation handling.

**Rationale.** 30 minutes is an existing platform standard for the maximum period an unactioned
order may hold stock at the **`PENDING`** stage (`RESERVATION_TTL_MS`). The threshold is reused
for `CONFIRMED` orders as a **consistent platform principle** — a confirmed order is no more
entitled to sit unactioned than an unpaid one — **not** because the reservation TTL applies to
`CONFIRMED` orders. It does not; see §5.

**This does not establish that any order was stranded because of a POS/integration defect.**
Attribution requires separate evidence. See §4.

The threshold lives in **one named constant**, so changing the policy later is a one-line change.

**Out of scope of this ruling:** that a `CONFIRMED` order retains its inventory reservation
indefinitely. That behaviour is recorded in §5 and is **not** to be changed as part of 8D-C.

---

## 2 · The statement

Read-only. One `SELECT`. Aggregate only — no order id, customer, merchant or address is returned.

```sql
-- 8D-C threshold: 30 minutes. This interval is the FOUNDER RULING of 2026-09-15,
-- not an engineering default. Changing it changes the policy.
SELECT count(*) AS s1_potentially_stranded_confirmed
FROM orders o
WHERE o.status = 'CONFIRMED'
  AND o.fulfillment_type = 'DELIVERY'
  AND COALESCE(o.confirmed_at, o.created_at) < now() - interval '30 minutes'
  AND NOT EXISTS (
        SELECT 1 FROM delivery_jobs dj WHERE dj.order_id = o.id
      );
```

### Every clause, and why it is there

| Clause                               | Why                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `status = 'CONFIRMED'`               | The state the ruling concerns. `PREPARING` means the merchant accepted — the order moved on.                                                                                                                                                                                                                                                                        |
| **`fulfillment_type = 'DELIVERY'`**  | **Load-bearing.** `OrderReadySubscriber` (`order-ready.subscriber.ts:33`) skips anything that is not `DELIVERY`, so a **`PICKUP` order never gets a `DeliveryJob` by design**. Without this clause every pickup order would be counted as stranded.                                                                                                                 |
| `COALESCE(confirmed_at, created_at)` | `confirmed_at` is the correct age anchor — time _in_ `CONFIRMED`, not time since checkout. It is set in the same write that sets the status (`payment.service.ts:718`), which is the **only** path into `CONFIRMED`, so it should always be present. The `COALESCE` is defence: a null would otherwise silently drop the row from the count rather than surface it. |
| `NOT EXISTS (delivery_jobs …)`       | `DeliveryJob.orderId` is `@unique`, so this is a clean existence test. A job means dispatch happened.                                                                                                                                                                                                                                                               |

---

## 3 · Fixture verification

Six orders, each designed to be excluded for a **different** reason, so that a clause silently
doing nothing would show up:

| Fixture | Setup                                                   | Intended                     | Result |
| ------- | ------------------------------------------------------- | ---------------------------- | ------ |
| **A-1** | `DELIVERY`, `CONFIRMED` 45 min, no job                  | **counted**                  | ✅     |
| A-2     | `DELIVERY`, `CONFIRMED` **5 min**, no job               | excluded — too recent        | ✅     |
| A-3     | **`PICKUP`**, `CONFIRMED` 45 min, no job                | excluded — no job by design  | ✅     |
| A-4     | `DELIVERY`, `CONFIRMED` 45 min, **has a job**           | excluded — dispatched        | ✅     |
| A-5     | `DELIVERY`, **`PREPARING`** 45 min, no job              | excluded — merchant accepted | ✅     |
| **A-6** | `DELIVERY`, `CONFIRMED` 50 min, **`confirmed_at` NULL** | **counted** via `COALESCE`   | ✅     |

**Result: 2 (A-1, A-6).**

A-3 and A-6 are the load-bearing fixtures. A-3 fails without the `fulfillment_type` clause; A-6
fails without the `COALESCE`, and would vanish from the count rather than error.

> An earlier run returned **3**. Investigation showed fixture A-4's `delivery_jobs` insert had
> failed on a column that does not exist, so the "has a job" case was not actually testing
> anything. The predicate was correct; the fixture was not. Recorded because a fixture that fails
> to set up its own precondition produces a **falsely passing** test, and the number would have
> been reported as verified.

---

## 4 · Attribution — what this number does NOT say

The count is **potentially** stranded. The database cannot distinguish:

- an order the POS failed to advance, from
- an order the merchant simply never accepted.

Both look identical: `CONFIRMED`, `DELIVERY`, no `DeliveryJob`, past the threshold.

**Do not report this figure as the impact of the POS/integration defect.** If a
merchant/integration discriminator is later added, attribution becomes a separate analytical
question with its own evidence.

---

## 5 · A related finding, deliberately not acted on

The reservation rationale examined during this ruling did **not** hold as first stated, and the
correction matters for anyone reading the number later:

- `RESERVATION_TTL_MS` (30 min) runs from **checkout**, not from confirmation.
- The cleanup sweep filters `status: OrderStatus.PENDING`
  (`prisma-orders.repository.ts:191`), so it **only** releases reservations for orders still
  awaiting payment.
- Nothing consumes or commits a reservation when payment confirms. The only three touchpoints are
  `reserve()` at checkout, `releaseForOrder()` on customer cancel of a `PENDING` order, and
  `releaseExpired()` for `PENDING` only.

**So a stranded `CONFIRMED` order holds its inventory reservation indefinitely** — not for 30
minutes. Whether that is intended (stock committed once paid, which is defensible) or an
oversight is a **separate question**, explicitly outside this ruling and **not** to be changed as
part of 8D-C.

It does mean a stranded order costs **inventory**, not only customer patience, which may bear on
how urgently remediation is treated.

---

## 6 · Recording the result

```
s1_potentially_stranded_confirmed = ____   as of <UTC timestamp>
```

Like `c5`, this is an **as-of** value, not a standing fact — orders enter and leave the population
continuously as merchants act on them. Unlike `c5` it can move in **both** directions, so a stale
figure is not conservative in either direction.

Record alongside it: the exact UTC timestamp, the environment, who ran it, and **the threshold in
force** (30 minutes) — so a result measured under one policy is never compared against one
measured under another.

---

## 7 · Sequence

```
definition  →  measurement  →  remediation
```

- **Definition** — ✅ ruled and encoded here.
- **Measurement** — ready; requires an authorized operator. Can ride along with the P4 session.
- **Remediation** — ⏸ **not decided.** What happens to these orders is a separate ruling. Nothing
  here cancels, declines, advances or otherwise mutates any order.

**Detection and state mutation remain separate.** This ruling answers _"when do we consider an
order potentially stranded?"_ — it does **not** authorise automatically cancelling orders after 30
minutes. That would be another product ruling.

If automatic detection is built later, `order-completion-sweep.service.ts` is the natural
mechanism: it already sweeps stale orders on a 15-minute interval with exactly this shape. Reusing
it would still require the remediation ruling first.
