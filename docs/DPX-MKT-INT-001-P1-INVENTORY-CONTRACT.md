# MKT-INT-001-J — Inventory Sync: implementation contract

**Document**: DPX-MKT-INT-001-P1-INVENTORY-CONTRACT.md
**Status**: Implemented, **awaiting founder / architecture sign-off on §4 and §5**
**Date**: 2026-09-12
**Supersedes nothing.** Extends `DPX-MKT-INT-001-P1-CATALOGUE-CONTRACT.md` (and its
Amendment 1) to the inventory-only push. Where the two disagree, the catalogue contract
wins — it is the approved one.

---

## 0. What existed before this

Stock could only move as a side effect of a **full catalogue push**: `IngestCatalogueItemDto`
carried an optional `quantity`, and `CatalogueIngestionService.applyInventory` wrote it. A POS
that wanted to report "SKU-12 is down to 3" had to re-send the item's name, price and category
as well, and there was no route at all for a till that only counts.

Three defects were found in that write path while building this increment. All three are
fixed here; none of them had a failing test, so none of them was visible.

| #   | Defect                                                                                                              | Consequence                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `previousQuantity` was read from the row the `upsert` had **already written**, so it always equalled `newQuantity`. | Every `InventoryUpdate` since the feature shipped claims the stock did not change. The audit trail cannot be reconciled against a merchant's shelf.  |
| 2   | The row's idempotency key was `` `${productSyncId}:${Date.now()}` ``.                                               | Every write was unique, so `@@unique([integrationId, idempotencyKey])` guarded nothing; and two writes in the same millisecond collided by accident. |
| 3   | `productInventory.upsert` is read-then-write with no lock.                                                          | Two concurrent writes to one product could interleave and record a `previousQuantity` neither of them started from.                                  |

None of the three ever reached production data: the catalogue push route
(`POST /api/v1/integrations/catalogue/sync`) is on the unmerged Merchant Connect branch, not
on `main`.

---

## 1. The writer

One service, `InventoryIngestionService`, owns every external write to
`ProductInventory.quantity`. The catalogue push now delegates to it rather than writing stock
itself. Two writers would be two chances to disagree about the rule the catalogue contract
calls out as mattering more than the rest:

> An external quantity sets `quantity` only. It **must never** write `reserved`.

Per write, inside one transaction, in this order:

1. `SELECT … FOR UPDATE` the product's inventory row, **joined to `products` with the
   merchant predicate in the same statement**, so a row that comes back is a row this
   merchant owns and nobody else can move until commit.
2. Insert the `InventoryUpdate` — so a replayed key aborts the transaction **before any stock
   has moved**.
3. Write `quantity` (and only `quantity`).
4. Insert the `StockMovement`.

A duplicate key rolls the whole transaction back, so there is no state in which the movement
log claims a change the quantity does not show. Recovery then re-reads the winner's row
**outside** the transaction, because in Postgres a unique violation aborts the enclosing
transaction and cannot be caught inside one.

Items within a batch are processed **sorted by `externalSku`**, so two concurrent batches
touching the same SKUs take their row locks in the same order rather than deadlocking.

---

## 2. Routes

| Method | Path                                                   | Auth                                      | Scope / permission  |
| ------ | ------------------------------------------------------ | ----------------------------------------- | ------------------- |
| `PUT`  | `/api/v1/integrations/inventory/sync`                  | integration credential (`@Public` to JWT) | `inventory:write`   |
| `GET`  | `/api/v1/integrations/inventory/levels/:integrationId` | JWT + `PermissionsGuard`                  | `integrations:read` |

**Why `inventory/sync` and not a bare `inventory`.** See §2.1 — a bare path was
unreachable.

`inventory:write` is already in the documented set on `IntegrationCredential.scopes` and is
already granted by default when an integration is created, so **no existing credential has to
be reissued**.

`IntegrationCredentialGuard` previously hard-coded `catalog:write`. It now reads the scope the
route declares via `@RequireIntegrationScope`, and **refuses a route that declares none**. Left
hard-coded, a stock-only key would have been able to reprice a merchant's shelf.

### 2.1 The route that was mapped but unreachable

The push first shipped at `PUT /api/v1/integrations/inventory`. It never ran.

`IntegrationsCController` registers `PUT /api/v1/integrations/:integrationId`, and Express
matches in registration order, so the CRUD update route swallowed every stock push — reading
the literal string `"inventory"` as an integration id and answering **401**, which is
indistinguishable from this route refusing an unauthenticated caller. Nest's own startup log
listed both paths as `Mapped`, because _mapped_ and _reachable_ are different things.

Nothing in the test suite could have caught it. The path was declared correctly, so the
route-metadata spec passed; the controller, guard and service unit tests all passed; the
17 real-database service tests passed, because they call the service directly. It was found by
driving the running API over HTTP and reading the **body** of the 401 rather than its status
code: `"Authentication required"` (the global JWT guard, on the CRUD route) versus
`"Integration credentials required"` (this route's own guard).

Two things changed as a result:

1. The routes moved to `inventory/sync` and `inventory/levels/:integrationId`, mirroring
   `catalogue/sync` and `catalogue/jobs/:integrationId`. A two-segment literal path cannot
   collide with a one-segment parameter however anything is ordered — the fix does not depend
   on controller registration order staying as it is today.
2. `pos-route-reachability.spec.ts` now reads the module's real controller order, expands every
   route, and fails if any earlier pattern swallows a POS route. Restoring the bare path turns
   the suite red.

The known mutual shadowing between `IntegrationsController` (legacy) and `IntegrationsCController`
on `GET`/`POST /integrations` is deliberately out of that check's scope: it is documented and the
catalogue contract explicitly leaves the legacy routes alone.

---

## 3. Behaviour

| Case                                            | Behaviour                                                                               |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| Quantity semantics                              | **absolute**, not a delta (catalogue contract §6)                                       |
| `reserved`                                      | never written                                                                           |
| Negative quantity                               | clamped to 0, one `NEGATIVE_QUANTITY` conflict; **not** re-raised on a replay           |
| SKU with no `ProductSync`                       | item rejected `SKU_NOT_MAPPED`; a product is **never** created from a stock count       |
| Mapping with `productId = null`                 | item rejected `SKU_NOT_LINKED` (this is deferred hazard 3, made visible)                |
| Mapping not `ACTIVE`                            | item rejected `MAPPING_INACTIVE`                                                        |
| Product deleted, or another merchant's          | item rejected `PRODUCT_UNAVAILABLE`                                                     |
| Same SKU twice in one batch                     | second rejected `DUPLICATE_IN_BATCH` — it would otherwise read as a replay of the first |
| One bad item                                    | recorded and skipped; the rest of the batch still applies (catalogue contract §9)       |
| Integration whose user has no `MerchantProfile` | 500 and a logged error — a DrippleX defect, not a bad payload                           |
| Per-item detail                                 | `IntegrationLog`, `correlationId` = the batch key (catalogue contract decision #8)      |

Rejection reasons are **response and log values only**. They are deliberately _not_
`IntegrationConflict.conflictType` values: an unmapped SKU is not a disagreement a merchant has
to settle, and inventing conflict types would put strings in a live audit table that no
approved contract names.

---

## 4. Divergences from the MKT-INT-001-J backlog entry — **sign-off requested**

The backlog entry predates the implementation and describes machinery the platform does not
have. Each divergence below is deliberate; none is a silent reinterpretation.

| #   | Backlog said                                              | Built                                                      | Why                                                                                                                                                                                                           |
| --- | --------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `PUT /api/integrations/{integrationId}/inventory`         | `PUT /api/v1/integrations/inventory/sync`                  | The credential already identifies the integration. A path id would be a second authorization surface to cross-check, and the catalogue push has no path id either. `/sync` rather than a bare path: see §2.1. |
| 2   | `202 ACCEPTED`, async processing                          | `200 OK` with the per-item outcome                         | There is no queue behind it. The work is finished when the response is written, and 202 would promise a later result that never arrives.                                                                      |
| 3   | Single-product route `…/inventory/{externalProductId}`    | not built                                                  | A one-item batch is the same call. A second route would be a second copy of the authorization and idempotency logic for no new capability. **Say if you want it anyway.**                                     |
| 4   | `GET …/inventory` audience unstated                       | merchant-facing (JWT) at `inventory/levels/:integrationId` | Matches the existing `jobs/:integrationId` and `mappings/:integrationId` convention. A POS-readable variant is a small addition if wanted.                                                                    |
| 5   | availability status `in_stock / low_stock / out_of_stock` | not accepted                                               | No such enum exists in DrippleX. `ProductInventory` has `quantity`, `manuallyDisabled` and `lowStockAlert`. Inventing an enum for an inbound payload would be speculative.                                    |
| 6   | "Reject negative stock unless backorder allowed"          | clamp to 0 + `NEGATIVE_QUANTITY` conflict                  | Catalogue contract §6 already ruled this, and it is the later, approved document. There is no backorder concept anywhere in the platform.                                                                     |
| 7   | "Check merchant quota/limits"                             | not built                                                  | No quota model exists. Recorded as a gap rather than invented.                                                                                                                                                |
| 8   | Idempotency-Key header                                    | **kept** — required, max 100 chars                         | Honoured as specified. Each row's key is `sha256(len:batchKey:sku)`, because `InventoryUpdate.idempotencyKey` is unique per **row** and is `VarChar(100)`.                                                    |

---

## 5. Decisions

### 5.1 `StockMovement.quantity` — **RULED, 2026-09-12. Closed.**

> **`quantity` carries the absolute resulting quantity, not the delta.**
>
> Stock going 10 → 7 records `previousQuantity = 10`, `newQuantity = 7`,
> `StockMovement.quantity = 7`. **Not −3.**

A movement row is a **snapshot**: a reader sees what the stock became without needing the row
before it. A delta stays derivable from two consecutive snapshots as
`newQuantity − previousQuantity`; the reverse does not hold, because one missing delta row makes
every later balance wrong. This also matches the behaviour the catalogue path already had, so
nothing that has already been written is reinterpreted.

The ruling was taken deliberately **before** any consumer of `StockMovement` exists — there is
still no reader anywhere in the codebase — so it costs nothing now and would have cost a
migration later.

Implemented as ruled (no code change was required; the behaviour already matched) and now
**pinned by a test**, `a movement records the resulting quantity, not the delta`, plus the
mutation below. A decision recorded only in a document is a decision a refactor is free to
flip.

_Superseded: the earlier draft of this section recommended switching to the delta. That
recommendation was not accepted and is not the standing position._

### 5.2 Still open — **deliberately not decided, and not implemented either way**

Ruled 2026-09-12: none of these is to be settled implicitly by writing code. They stay as
recorded gaps until a decision is taken explicitly.

1. **Unmapped SKU on a stock push.** Reported per item and logged, with no `IntegrationConflict`
   row. Whether merchants should see these in the conflicts queue needs a new `conflictType`,
   which needs approval per catalogue contract Amendment 1. **Left exactly as specified above
   until that decision is resolved.**
2. **`trackInventory = false` from a POS.** Every write forces `true`, carried over from the
   catalogue path, so a POS cannot express "not stock-tracked at source" (catalogue contract §5).
   **Not introduced** — that would be adding a POS capability implicitly.
3. **Rate limiting on the stock push.** None, and the catalogue push has none either. This is an
   **outstanding operational control**, not a number for an engineer to pick: a permanent
   business limit chosen silently in code is a business decision made by accident. To be
   implemented once the appropriate limit is determined.

---

## 6. Deferred hazards — untouched, as instructed

Named here because the writer's behaviour is shaped around them, not because they are fixed.

1. **`MerchantScoped` returns `user.id`, not a merchant id.** Bridged through
   `MerchantProfileResolver`, now a single shared service so the two ingestion paths cannot
   drift into two different bridges.
2. **`ProductSync.productId` has no FK to `Product`.** The database will hold a mapping under
   merchant A pointing at merchant B's product. The writer refuses such a row on its own — see
   the test `a mapping pointing at another merchant's product is refused`.
3. **An interrupted catalogue batch can leave `ProductSync.productId` null.** The writer reports
   it as `SKU_NOT_LINKED` rather than papering over it, because the fix is to re-push the
   catalogue, not the stock.

---

## 7. Verification

Every guard was removed one at a time and the suite confirmed to go red. A green suite is not
evidence.

| Mutation                                           | Result                                          |
| -------------------------------------------------- | ----------------------------------------------- |
| Row lock (`FOR UPDATE`) removed                    | 🔴 1 failed — concurrent writes no longer chain |
| `previousQuantity` recorded as `newQuantity`       | 🔴 2 failed — the original defect               |
| `reserved` written                                 | 🔴 3 failed                                     |
| P2002 replay recovery removed                      | 🔴 2 failed                                     |
| Both merchant-ownership checks removed             | 🔴 2 failed                                     |
| Duplicate-in-batch guard removed                   | 🔴 1 failed                                     |
| Negative clamp removed                             | 🔴 2 failed                                     |
| Conflict re-raised on replay                       | 🔴 1 failed                                     |
| `mappingStatus` check removed                      | 🔴 1 failed                                     |
| Unlinked-mapping check removed                     | 🔴 1 failed                                     |
| Movement records the delta instead of the snapshot | 🔴 1 failed — §5.1's ruling, enforced           |
| `@RequireIntegrationScope` removed from the route  | 🔴 2 failed                                     |

### End-to-end, over real HTTP

Unit and service tests cannot prove a route is reachable, so the whole path was driven against a
locally running API — credential headers, guard, scope check, service, database, response:

| Check                                                      | Result                                           |
| ---------------------------------------------------------- | ------------------------------------------------ |
| An authenticated push is accepted                          | 200, `appliedCount: 1`                           |
| Quantity is the absolute value the POS sent                | 10 → 3                                           |
| `reserved` was not touched                                 | stayed 4                                         |
| `previousQuantity` is the value before the write           | 10 → 3 recorded                                  |
| The movement records the resulting quantity, not the delta | `quantity = 3`                                   |
| Replaying the key applies nothing                          | `replayedCount: 1`, quantity still 3             |
| A `catalog:write`-only credential cannot push stock        | 401                                              |
| A push without `Idempotency-Key`                           | 400                                              |
| Another merchant's SKU                                     | rejected `SKU_NOT_MAPPED`, their stock untouched |

12 assertions, 12 passed. The harness seeds through Prisma and speaks only the documented POS
surface; folding it into the JWT-based `tools/pos-simulator` is the remaining tidy-up, not a gap
in what was proven.

**Stated honestly:** the two merchant-ownership checks — the one in `ensureInventoryRow` and the
one inside the locking query — are _redundant by design_. Removing **either alone** leaves the
suite green, because the other catches it; removing **both** goes red. That is defence in
depth working as intended, not two independently proven guards, and it is recorded as such
rather than reported as twelve independent proofs.

---

**Related:** `docs/DPX-MKT-INT-001-P1-CATALOGUE-CONTRACT.md` ·
`docs/DPX-MKT-INT-001-IMPLEMENTATION-BACKLOG.md` (ticket J) ·
`docs/DPX-MKT-INT-001-C-SCHEMA.md`
