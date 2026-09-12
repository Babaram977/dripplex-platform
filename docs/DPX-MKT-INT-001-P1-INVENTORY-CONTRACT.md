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

| Method | Path                                            | Auth                                      | Scope / permission  |
| ------ | ----------------------------------------------- | ----------------------------------------- | ------------------- |
| `PUT`  | `/api/v1/integrations/inventory`                | integration credential (`@Public` to JWT) | `inventory:write`   |
| `GET`  | `/api/v1/integrations/inventory/:integrationId` | JWT + `PermissionsGuard`                  | `integrations:read` |

`inventory:write` is already in the documented set on `IntegrationCredential.scopes` and is
already granted by default when an integration is created, so **no existing credential has to
be reissued**.

`IntegrationCredentialGuard` previously hard-coded `catalog:write`. It now reads the scope the
route declares via `@RequireIntegrationScope`, and **refuses a route that declares none**. Left
hard-coded, a stock-only key would have been able to reprice a merchant's shelf.

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

| #   | Backlog said                                              | Built                                     | Why                                                                                                                                                                        |
| --- | --------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `PUT /api/integrations/{integrationId}/inventory`         | `PUT /api/v1/integrations/inventory`      | The credential already identifies the integration. A path id would be a second authorization surface to cross-check, and the catalogue push has no path id either.         |
| 2   | `202 ACCEPTED`, async processing                          | `200 OK` with the per-item outcome        | There is no queue behind it. The work is finished when the response is written, and 202 would promise a later result that never arrives.                                   |
| 3   | Single-product route `…/inventory/{externalProductId}`    | not built                                 | A one-item batch is the same call. A second route would be a second copy of the authorization and idempotency logic for no new capability. **Say if you want it anyway.**  |
| 4   | `GET …/inventory` audience unstated                       | merchant-facing (JWT), not POS-facing     | Matches the existing `jobs/:integrationId` and `mappings/:integrationId` convention. A POS-readable variant is a small addition if wanted.                                 |
| 5   | availability status `in_stock / low_stock / out_of_stock` | not accepted                              | No such enum exists in DrippleX. `ProductInventory` has `quantity`, `manuallyDisabled` and `lowStockAlert`. Inventing an enum for an inbound payload would be speculative. |
| 6   | "Reject negative stock unless backorder allowed"          | clamp to 0 + `NEGATIVE_QUANTITY` conflict | Catalogue contract §6 already ruled this, and it is the later, approved document. There is no backorder concept anywhere in the platform.                                  |
| 7   | "Check merchant quota/limits"                             | not built                                 | No quota model exists. Recorded as a gap rather than invented.                                                                                                             |
| 8   | Idempotency-Key header                                    | **kept** — required, max 100 chars        | Honoured as specified. Each row's key is `sha256(len:batchKey:sku)`, because `InventoryUpdate.idempotencyKey` is unique per **row** and is `VarChar(100)`.                 |

---

## 5. Open questions — **decisions required**

1. **`StockMovement.quantity` semantics.** For an absolute set, this records the _new absolute
   quantity_, not the delta. That is the behaviour the catalogue path already had and the
   catalogue contract does not specify it. Nothing in the codebase reads `StockMovement` yet, so
   changing it to `newQuantity − previousQuantity` is cheap **now** and expensive later.
   _Recommendation: change it to the delta before anything reads the table._
2. **Unmapped SKU on a stock push.** Currently reported per item and logged, with no
   `IntegrationConflict` row. If merchants should see these in the conflicts queue, that needs a
   new `conflictType` — which needs approval, per catalogue contract Amendment 1.
3. **`trackInventory`.** Every write forces it to `true`, carried over from the catalogue path.
   A POS therefore cannot express "not stock-tracked at source", which catalogue contract §5
   maps to `trackInventory = false`. Left as-is rather than changed silently.
4. **Rate limiting.** The stock push has none. The catalogue push has none either. Support
   ticket creation is throttled at 10/hour; a POS pushing stock is a different shape of caller
   and needs its own number.

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

| Mutation                                          | Result                                          |
| ------------------------------------------------- | ----------------------------------------------- |
| Row lock (`FOR UPDATE`) removed                   | 🔴 1 failed — concurrent writes no longer chain |
| `previousQuantity` recorded as `newQuantity`      | 🔴 1 failed — the original defect               |
| `reserved` written                                | 🔴 3 failed                                     |
| P2002 replay recovery removed                     | 🔴 2 failed                                     |
| Both merchant-ownership checks removed            | 🔴 2 failed                                     |
| Duplicate-in-batch guard removed                  | 🔴 1 failed                                     |
| Negative clamp removed                            | 🔴 2 failed                                     |
| Conflict re-raised on replay                      | 🔴 1 failed                                     |
| `mappingStatus` check removed                     | 🔴 1 failed                                     |
| Unlinked-mapping check removed                    | 🔴 1 failed                                     |
| `@RequireIntegrationScope` removed from the route | 🔴 2 failed                                     |

**Stated honestly:** the two merchant-ownership checks — the one in `ensureInventoryRow` and the
one inside the locking query — are _redundant by design_. Removing **either alone** leaves the
suite green, because the other catches it; removing **both** goes red. That is defence in
depth working as intended, not two independently proven guards, and it is recorded as such
rather than reported as eleven independent proofs.

---

**Related:** `docs/DPX-MKT-INT-001-P1-CATALOGUE-CONTRACT.md` ·
`docs/DPX-MKT-INT-001-IMPLEMENTATION-BACKLOG.md` (ticket J) ·
`docs/DPX-MKT-INT-001-C-SCHEMA.md`
