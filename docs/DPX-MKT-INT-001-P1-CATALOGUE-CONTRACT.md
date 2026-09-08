# DPX-MKT-INT-001 Phase 1 — Catalogue Ingestion Contract

**Status: CONTRACT FOR APPROVAL. No implementation.**

The first Phase 1 gate. Establishes how an external POS catalogue becomes a DrippleX
catalogue, before substantial sync code is written.

Read against `main` @ `03759c9`. Every constraint below was read out of the schema or the
services as they exist, not assumed. Where the existing models cannot express what a POS
sends, that is recorded as an open decision rather than resolved by invention.

```
External POS  ──►  Integration layer (MKT-INT-001)  ──►  DrippleX catalogue
                   MerchantIntegration                    Product
                   ProductSync        (mapping)           ProductVariant
                   CatalogSyncJob     (batch)             ProductInventory
                   InventoryUpdate    (stock)             StockMovement
                   IntegrationConflict(divergence)        Category (global)
```

---

## 0. The constraint that shapes everything else

`MerchantProductsService.createProduct(userId, dto)` resolves the merchant via
`requireMerchantId(userId)`. **An integration has no user.** It authenticates as an
integration credential scoped to a `merchantId`, and `MerchantIntegration.merchantId` is a
bare indexed UUID with no relation.

So ingestion cannot call the merchant product service as it stands. Three options:

| Option                                                                                                                                                                                 | Cost                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **A. Extract a merchant-scoped core** — `createProductForMerchant(merchantId, dto)`, with the existing `createProduct(userId, …)` becoming a thin wrapper that resolves the user first | Small refactor of a service with existing tests; both paths then share validation, slug generation and search indexing |
| B. Duplicate the logic in an ingestion service                                                                                                                                         | Two code paths that must agree for ever. Rejected.                                                                     |
| C. Give each integration a synthetic system user                                                                                                                                       | Invents an identity that does not exist and pollutes `actorUserId` audit trails                                        |

**Recommendation: A.** It is the only option that keeps one write path, which matters
because `createProduct` also drives `ProductSearchSyncService` — a second path would leave
the search index silently inconsistent for POS-ingested products.

**Decision required.**

---

## 1. Product identity / external IDs

**Decided — the schema already settles it.**

`ProductSync` carries `@@unique([integrationId, externalSku])`. That is the identity
anchor: one external SKU maps to at most one DrippleX product **per integration**.

It cannot be `Product.sku`, because that column is `String?` — nullable and **not unique**,
with no `@@unique([merchantId, sku])`. DrippleX does not treat SKU as an identity today and
this contract does not change that.

| Rule                 |                                                                           |
| -------------------- | ------------------------------------------------------------------------- |
| Lookup key           | `(integrationId, externalSku)`                                            |
| `externalSku`        | required, ≤100 chars (`VarChar(100)`), trimmed, compared case-sensitively |
| First sight of a SKU | create `ProductSync` + `Product`, store `productId`                       |
| Later sight          | update the mapped `Product`                                               |
| `externalCatalogId`  | optional POS-side catalogue/branch identifier, already on the model       |

**🔴 Gap to close in implementation.** `ProductSync.productId` is `String?` with **no
relation to `Product`** — the database will not stop a mapping outliving its product. This
is the same missing-FK pattern as `integration_credentials.integration_id`. Ingestion must
therefore treat a mapping whose `productId` no longer resolves as **remap-or-conflict**,
never as "product exists".

---

## 2. Category mapping

**Decided, and it is more restrictive than it first appears.**

`Category` is **global**: `slug @unique` across the whole platform, no `merchantId`. It is a
shared taxonomy, not a per-merchant one.

**A POS must never create a DrippleX category.** One merchant's POS naming its category
"Drinks" would otherwise claim that slug platform-wide, for every merchant.

| External category              | Behaviour                                                                                                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Matches an explicit mapping    | set `Product.categoryId`                                                                                                                                                |
| No mapping                     | leave `categoryId` **null** (the column is nullable) and raise `IntegrationConflict` with `conflictType = 'CATEGORY_UNMAPPED'`, `externalValue` = the POS category name |
| Mapped to an inactive category | ingest, raise `CATEGORY_INACTIVE`                                                                                                                                       |

An uncategorised product still ingests. Blocking the whole item on taxonomy would make a
category gap look like a catalogue outage.

**🟠 Open:** where the mapping table lives. `IntegrationConflict` records the _problem_, not
the _resolution_. There is no `CategoryMapping` model. Options: a new model, or `metadata`
JSON on `MerchantIntegration` (which exists). **Decision required** — recommend a dedicated
model, because a mapping is operational data an Operations agent will need to edit.

---

## 3. Variants

**🔴 This is the significant impedance mismatch, and it needs a founder decision.**

What DrippleX has:

- `ProductVariant` — `name`, nullable non-unique `sku`, `priceOverride`, `isActive`
- `ProductInventory` — **`productId @unique`**, i.e. **one inventory row per _product_**
- `ProductVariant` has **no inventory relation at all**

Most POS systems track stock **per variant/SKU**, not per product. DrippleX cannot represent
"Large: 4 in stock, Small: 0 in stock" — there is one `quantity` for the whole product.

| Option                                                                                   | Consequence                                                                                                                         |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **A. One DrippleX `Product` per external SKU** (variants flattened to separate products) | Stock is correct per SKU. Catalogue shows "T-Shirt Large" and "T-Shirt Small" as separate products. Uses existing models unchanged. |
| **B. Product + variants, inventory at product level only**                               | Catalogue reads naturally. **Stock is wrong per variant** — a sold-out size still appears buyable. Would oversell.                  |
| C. Add inventory-per-variant                                                             | Schema change to a live commerce model, touches cart, orders, reservations. Far outside Phase 1.                                    |

**Recommendation: A for Phase 1**, because B can oversell and C is not a catalogue-ingestion
change. A is honest about what the platform can currently guarantee.

**Decision required.** This one shapes the ingestion payload, so it is the blocking item.

---

## 4. Prices

**Decided.**

| Field                      | Rule                                                                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Product.basePrice`        | `Decimal(12,2)` ← external price. Must be ≥ 0 and ≤ 12 digits.                                                                                     |
| `Product.currency`         | `VarChar(3)`, defaults `NGN`                                                                                                                       |
| Non-NGN payload            | **reject the item**, raise `CURRENCY_UNSUPPORTED`. Do not convert — DrippleX has no FX source, and a silently converted price is a mispriced sale. |
| More than 2 decimal places | reject; do not round. Rounding money without being asked is a decision, not a normalisation.                                                       |
| Variant price              | `priceOverride` (only if option B in §3 is chosen)                                                                                                 |

**Merchant-edited prices:** if DrippleX's `basePrice` differs from the last synced external
price _and_ the product was updated after `ProductSync.lastSyncedAt`, that is a conflict
(§10), not an overwrite.

---

## 5. Availability

**Decided.** Availability and stock are different things and must not be conflated.

| External signal                          | DrippleX field                             |
| ---------------------------------------- | ------------------------------------------ |
| Product active / listed                  | `Product.status = PUBLISHED`               |
| Product inactive / unlisted              | `Product.status = ARCHIVED`                |
| Temporarily unavailable, stock unchanged | `ProductInventory.manuallyDisabled = true` |
| Not stock-tracked at source              | `ProductInventory.trackInventory = false`  |

First ingestion of a new product creates it as **`DRAFT`**, not `PUBLISHED`. A merchant's POS
connecting for the first time must not publish their entire catalogue to customers
unreviewed. Promotion to `PUBLISHED` is an explicit merchant action or an explicit
integration setting.

**🟠 Open:** whether that setting should exist per-integration (`autoPublish`). Recommend
yes, defaulting off. **Decision required.**

---

## 6. Inventory quantities

**Decided, with one rule that matters more than the rest.**

`ProductInventory` has `quantity` **and** `reserved`. `reserved` is DrippleX-owned — it is
carts and in-flight orders (`InventoryReservation`). A POS knows nothing about it.

> **An external quantity sets `quantity` only. It must never write `reserved`.**
> Clobbering `reserved` would release stock already promised to a customer mid-checkout.

| Rule              |                                                                                                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Semantics         | external quantity is **absolute**, not a delta                                                                                                                       |
| Write             | `ProductInventory.quantity = external`                                                                                                                               |
| Audit             | one `StockMovement`, `type = ADJUSTMENT`, `balanceAfter` = new quantity, `referenceType = 'INTEGRATION'`, `referenceId` = `InventoryUpdate.id`, `actorUserId = null` |
| Negative quantity | clamp to 0, raise `NEGATIVE_QUANTITY`                                                                                                                                |
| Record            | `InventoryUpdate` with `previousQuantity`, `newQuantity`, `sourceType`, `idempotencyKey`                                                                             |

`StockMovementType` has no `SYNC` member; `ADJUSTMENT` is the honest existing fit, made
identifiable by `referenceType`.

**🟠 Note:** `InventoryUpdate` carries `deliveryStatus` and `attemptCount`, which describe
**outbound** delivery to a POS. For inbound ingestion those are not meaningful. Proposal:
inbound rows use `deliveryStatus = 'APPLIED'` and `attemptCount = 0`, and `sourceType`
distinguishes direction. **Confirm** rather than repurpose silently.

---

## 7. Deletes and deactivations

**Decided. Nothing is ever hard-deleted.**

`OrderItem` references `Product`. A hard delete would break order history — the record of
what a customer bought.

| External event              | DrippleX                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| Product deleted at source   | `Product.status = ARCHIVED`, `isDeleted = true`, `ProductSync.mappingStatus = 'DELETED_AT_SOURCE'` |
| Product deactivated         | `status = ARCHIVED`, mapping stays `ACTIVE`                                                        |
| Disappears from a full sync | **not** a delete — see below                                                                       |
| Reappears later             | un-archive the same `Product` via the existing mapping; never create a duplicate                   |

**Absence is not deletion.** A product missing from one full-sync payload may mean a
truncated upload or a filtered export. A full sync marks absent items with
`mappingStatus = 'MISSING_FROM_SYNC'` and raises `PRODUCT_ABSENT`; two consecutive full syncs
must agree before anything is archived.

---

## 8. Idempotency

**Partly decided — one gap.**

`InventoryUpdate` already has `@@unique([integrationId, idempotencyKey])`. Stock updates are
therefore idempotent by construction.

**🔴 Catalogue ingestion has no equivalent.** Neither `CatalogSyncJob` nor `ProductSync`
carries an idempotency key, so a retried batch would re-run.

| Level  | Mechanism                                                                                                                               |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Batch  | **needs a field** — proposed `CatalogSyncJob.idempotencyKey` + `@@unique([integrationId, idempotencyKey])`, mirroring `InventoryUpdate` |
| Item   | naturally idempotent: `(integrationId, externalSku)` upsert converges                                                                   |
| Replay | same key ⇒ return the original job, do not re-run                                                                                       |

This is the one **schema addition** Phase 1 requires. Additive, one nullable column plus a
unique index. **Approval required** before it is written.

---

## 9. Validation failures

**Decided: per item, never per batch.**

One malformed row must not reject a merchant's whole catalogue.

| Class                                                    | Behaviour                                  |
| -------------------------------------------------------- | ------------------------------------------ |
| Item invalid (missing SKU/name, bad price, bad currency) | skip that item, record it, continue        |
| Payload unparseable / auth failure                       | fail the job before any write              |
| Job outcome                                              | `PARTIAL` when some items failed — see §11 |

**🔴 Gap.** `CatalogSyncJob.failureReason` is a single `VarChar(500)` — one string for the
whole job. It cannot carry per-item errors, and a merchant needs to know _which_ SKU failed
and why.

Options: reuse `IntegrationLog` per failed item, or add a `CatalogSyncItem` model.
**Recommend `IntegrationLog`** for Phase 1 — the model exists, it is already merchant-scoped
and auditable, and it avoids a new table before the shape is proven. **Decision required.**

---

## 10. Conflicts

**Decided.** A conflict is _divergence after a human edit_, not merely a difference.

| `conflictType`                               | Raised when                                                                            |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| `PRICE_DIVERGED`                             | `Product.updatedAt > ProductSync.lastSyncedAt` **and** external price ≠ DrippleX price |
| `NAME_DIVERGED`                              | same, for name                                                                         |
| `CATEGORY_UNMAPPED` / `CATEGORY_INACTIVE`    | §2                                                                                     |
| `CURRENCY_UNSUPPORTED` / `NEGATIVE_QUANTITY` | §4, §6                                                                                 |
| `PRODUCT_ABSENT`                             | §7                                                                                     |
| `SKU_COLLISION`                              | one external SKU resolving to two products                                             |

`IntegrationConflict` already carries `dripplexValue`, `externalValue`, `status`,
`resolution`, `resolvedAt` — sufficient without change.

**Resolution policy — decision required.** Which side wins by default?

- **POS wins** — the POS is the source of truth (MKT-INT-001's stated vision: _"Merchant POS becomes the source of truth"_), but silently discards merchant edits made in DrippleX
- **DrippleX wins until resolved** — no silent data loss, but the catalogue drifts from the till
- **Recommended: raise and hold.** Do not overwrite a diverged field; keep the DrippleX value, mark the conflict `OPEN`, and let the merchant choose. Non-diverged fields on the same product still sync.

---

## 11. Sync-job lifecycle and observability

**Decided.** `CatalogSyncJob.jobStatus` is `VarChar(50)` with no enum, so values are fixed here:

```
PENDING ──► RUNNING ──► SUCCEEDED
                   ├──► PARTIAL     (completed; some items failed)
                   └──► FAILED      (aborted before/during; nothing usable)
```

| Field                       | Use                                                |
| --------------------------- | -------------------------------------------------- |
| `syncDirection`             | `FROM_EXTERNAL` for Phase 1 ingestion              |
| `startedAt` / `completedAt` | set on RUNNING / on terminal state                 |
| `productCount`              | items **successfully applied**, not items received |
| `failureReason`             | terminal summary only; per-item detail per §9      |

Observability: every job start and terminal transition writes an `AuditLog` via
`auditService.record`, as the credential operations already do. A merchant-facing endpoint
lists their own jobs — merchant-scoped, using the `integrations:read` permission that #357
seeded.

**🟠 Open:** ingestion trigger — POS pushes to a DrippleX endpoint, or DrippleX polls the
POS. The models support both (`syncDirection` exists), the SSRF protection service exists for
outbound calls, and the MKT-INT-001 architecture describes both. **Decision required**;
recommend **push-only for Phase 1** — no scheduler, no outbound credentials in play, and the
merchant controls when their catalogue moves.

---

## Summary of decisions required before implementation

| #     | Decision                                                           | Why it blocks                                       |
| ----- | ------------------------------------------------------------------ | --------------------------------------------------- |
| **1** | **§3 Variants — flatten per SKU (A) or product+variants (B)**      | Determines the ingestion payload shape. Blocking.   |
| **2** | §0 Extract `createProductForMerchant` from the user-scoped service | Determines whether there is one write path or two   |
| **3** | §8 Add `CatalogSyncJob.idempotencyKey` — the one schema change     | Additive migration; needs approval                  |
| **4** | §10 Conflict policy — recommend raise-and-hold                     | Decides whether merchant edits can be silently lost |
| **5** | §11 Push vs poll — recommend push-only                             | Determines whether a scheduler exists at all        |
| **6** | §2 Where category mappings live                                    | Operational data with no home today                 |
| **7** | §5 `autoPublish` per integration, default off                      | Decides whether a first sync publishes a catalogue  |
| **8** | §9 Per-item errors via `IntegrationLog` or a new model             | Decides whether a new table appears                 |
| **9** | §6 Inbound reuse of `deliveryStatus` / `attemptCount`              | Avoids silently repurposing outbound fields         |

## Out of scope, restated

No DrippleX POS application · no B8 · no customer or mobile change · no Google Play change ·
no wallet or ledger change · no Phase D lifecycle work (rotation overlap, master-key
rotation, orphan cleanup) · no order or status integration beyond what the catalogue contract
directly requires · no deletion of the shadowed legacy routes · no permission renaming.

---

**Related:** `docs/DPX-MKT-INT-001-MERCHANT-INTEGRATION-PLATFORM.md` ·
`docs/DPX-MKT-INT-001-C-SCHEMA.md` · `docs/DPX-MKT-INT-001-IMPLEMENTATION-BACKLOG.md` ·
`docs/CATALOG-ERD.md` · `docs/MARKETPLACE-FOUNDATION.md`
