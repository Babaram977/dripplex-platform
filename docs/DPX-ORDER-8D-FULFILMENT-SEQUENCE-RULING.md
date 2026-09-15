# DPX-ORDER-8D · POS fulfilment sequence — ruling record

**Ruled 2026-09-14.** Option **A (strict)** is chosen. Part **C** remains open.

---

## 1 · The behaviour, as the code actually is

Verified in `apps/backend/src/orders/merchant-orders.service.ts`:

| Transition    | Precondition                              | Result        |
| ------------- | ----------------------------------------- | ------------- |
| `acceptOrder` | status **must be `CONFIRMED`** (line 72)  | → `PREPARING` |
| `markReady`   | status **must be `PREPARING`** (line 146) | → `READY`     |

`READY` publishes `ORDER_READY`; `OrderReadySubscriber` is what creates the `DeliveryJob`.

So a POS that calls `markReady` on a `CONFIRMED` order receives **409**, the order **stays
`CONFIRMED`**, `ORDER_READY` never fires, no `DeliveryJob` is created, and **no rider is ever
dispatched**.

> The relevant state is **`CONFIRMED`**. This is not a `PENDING`-order problem, and a ruling
> drafted against `PENDING` would target the wrong transition.

---

## 2 · Why this needed a ruling rather than a fix

The failure is **explicit to the integrator and effectively silent to everyone else.** The POS
gets a 409 and a visible conflict, so whoever wrote the integration can see it. But nothing
surfaces to the merchant or the customer: the order simply stops progressing, and the customer
waits for a rider who was never dispatched.

Choosing between "tighten the state machine" and "loosen it" would have silently decided a
customer-experience question. Hence a ruling.

---

## 3 · The ruling

### A — Strict sequencing. **Chosen.**

The legitimate route is, and remains:

```
CONFIRMED  →  PREPARING  →  READY  →  DISPATCH
```

- `markReady` **must not** implicitly accept an order.
- `acceptOrder` remains a **meaningful merchant acceptance gate**, not a formality.
- Do **not** implement implicit acceptance.

### B — Implicit acceptance. **Rejected.**

Permitting `CONFIRMED → READY` by passing internally through `PREPARING` would dispatch the
order, but would cost `acceptOrder` its meaning as a hard fulfilment gate. Rejected.

### The governing product rule, which is larger than A-vs-B

> **An order must never silently strand.**

An order must reach a meaningful outcome — fulfilment and dispatch, or a failure that is
**communicated to the appropriate actors**. A customer must not be left believing an order is
progressing when it has stopped.

This reframes the engineering question. It is **not** "should the transition be lenient?" It is:

**How is a stalled order detected and surfaced, so that the merchant and customer are not left
unaware that it has stopped progressing?**

That is a better answer than weakening the state machine, and it is the work A implies.

---

## 4 · C — existing production orders. **Open.**

Choosing A does **not** repair orders already stranded at `CONFIRMED`. C is independent and
stays open, in three strictly separate steps:

```
definition  →  measurement  →  remediation
```

**None of these may be smuggled into a SQL `WHERE` clause.**

### Why C cannot be measured yet

1. **`CONFIRMED` alone is not evidence of stranding.** A freshly confirmed order is _supposed_ to
   be `CONFIRMED`. Only age distinguishes a stranded order from a healthy one — and the
   threshold is a **product ruling**, not a schema fact. Picking a number in a query would be
   quietly deciding part of C.

2. **The database may not separate the two populations.** An order stranded by this defect looks
   identical to one where a merchant simply has not accepted yet: `CONFIRMED`, no `DeliveryJob`.
   Any count will contain both unless a further discriminator is ruled — POS-integration presence
   on the merchant, perhaps, though that is an inference rather than a fact the row carries.

Any eventual C measurement must therefore state its **population definition and its limitations**
alongside the number.

### When C is ruled

The measurement should travel with the **P4 operator session** (see
`docs/ops/DPX-MKT-INT-001-P1-POS-P4-INVENTORY-RUNBOOK.md`) — same operator, same access, one
extra `SELECT` — rather than causing a second production-access round trip.

**No C query has been prepared or executed.** Deliberately: preparing one before the definition
is ruled would embed the unruled threshold.

---

## 5 · Status

| Part                          | State                                                        |
| ----------------------------- | ------------------------------------------------------------ |
| **A vs B**                    | ✅ **Ruled — A (strict).** No implicit acceptance.           |
| Governing rule                | ✅ **Ruled** — orders must not silently strand.              |
| Detection/surfacing mechanism | ⏸ Engineering design, authorised by A, not yet specified.    |
| **C**                         | ⏸ **Open** — definition, then measurement, then remediation. |

**Nothing in this ruling has been implemented.** It records a decision; it changes no behaviour.
