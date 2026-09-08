# DPX-MKT-INT-001 Phase 1 — Catalogue Ingestion Implementation Plan

**Status: PLAN FOR REVIEW. Implementation gate open; three findings need a ruling first.**

Implements `docs/DPX-MKT-INT-001-P1-CATALOGUE-CONTRACT.md`, merged to `main` as `3b63c28`
with all nine decisions approved.

Read against `main` @ `3b63c28`. Everything below was read out of the code, not assumed.

---

## Part 1 — Three findings from reading the code

The contract was written against the schema. Building against the **services** surfaced three
things the contract could not see. None of them reopens a decision; two of them change how a
decision must be implemented.

### 🔴 Finding 1 — `merchant_integrations.merchant_id` holds a **User ID**, not a merchant ID

This is the blocking one. It is not a naming quibble; the two columns point at different tables.

| Evidence                             |                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `merchant-scoped.decorator.ts:37`    | `const merchantId = user.id;` with the comment _"For now, use user.id as merchantId"_            |
| `integrations.service.ts:122`        | writes the same value back as `userId: merchantId` in the audit record                           |
| `schema.prisma` — `Product.merchant` | `MerchantProfile @relation(fields: [merchantId], references: [id])` — a **`MerchantProfile.id`** |
| `merchant-products.service.ts:519`   | `requireMerchantId(userId)` → `merchantProfile.findUnique({ where: { userId } })` → `profile.id` |

So `integration.merchantId` is a `User.id`, and `Product.merchantId` must be a
`MerchantProfile.id`. Writing `product.create({ merchantId: integration.merchantId })` would
violate the foreign key on every single ingested product.

The contract's §0 said `MerchantIntegration.merchantId` is "a bare indexed UUID with no
relation" — correct, but it inferred from the column name that the UUID _was_ a merchant id.
It is not.

| Option                                                                                                                                                                                                                         | Assessment                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Resolve at ingestion** — `merchantProfile.findUnique({ where: { userId: integration.merchantId } })`, a unique lookup (`MerchantProfile.userId` is `@unique`), and fail the job with a clear error when no profile exists | **Recommended for Phase 1.** No data migration, no change to any existing endpoint, entirely inside the ingestion path.                                             |
| B. Fix the decorator and backfill `merchant_integrations.merchant_id` to real profile ids                                                                                                                                      | Correct long-term, but a data migration on a deployed table plus behaviour changes to all fourteen existing integration endpoints. Outside the authorised boundary. |

**Recommend A now, B recorded as a follow-up.** Ingesting under option A is correct today and
stays correct after B, because the resolution helper is the only thing that would change.

**Ruling required.**

### 🔴 Finding 2 — nothing authenticates an incoming POS request

`credentialsService.verifyIncomingCredential` exists and is tested, but
`grep -rn "verifyIncomingCredential" apps/backend/src` returns **one hit: its own definition.**
No guard calls it. There is no route in the codebase a POS can authenticate against.

Decision #5 (push-only) therefore requires building that guard — a piece of work the contract
did not enumerate because it was reasoning about data shape, not transport. It is genuinely
required by the approved decision, so it is in scope, but it should be visible rather than
discovered in the diff.

### 🟠 Finding 3 — the contract fixed vocabularies that contradict the schema's documented values

All four columns are `VarChar` with no enum, so both vocabularies are storable. Using both
would leave two disagreeing sets of magic strings in one module.

| Field                              | Contract says                        | Schema doc comment says                                           | Recommend                                                                                                                                                                                                      |
| ---------------------------------- | ------------------------------------ | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CatalogSyncJob.syncDirection`     | `FROM_EXTERNAL`                      | `POS_TO_DRIPPLEX` / `DRIPPLEX_TO_POS`                             | **`POS_TO_DRIPPLEX`** — it exists, it is directional, and the export value is already named                                                                                                                    |
| `CatalogSyncJob.jobStatus`         | `RUNNING`, `SUCCEEDED`, `PARTIAL`    | `PENDING`, `IN_PROGRESS`, `COMPLETED`, `FAILED`                   | **`PENDING → IN_PROGRESS → COMPLETED \| PARTIAL \| FAILED`** — keep the schema's three, add only `PARTIAL`, which is genuinely new and which decision #8 requires                                              |
| `InventoryUpdate.deliveryStatus`   | `APPLIED`                            | `PENDING`, `DELIVERED`, `FAILED`                                  | **`DELIVERED`** — decision #9 approved _reuse of existing fields_; `APPLIED` would be a new value, which is the opposite of reuse                                                                              |
| `IntegrationConflict.conflictType` | `PRICE_DIVERGED`, `NAME_DIVERGED`, … | `CATALOG_PRICE_DIFF`, `INVENTORY_MISMATCH`, `PRODUCT_ARCHIVED`, … | **Reuse `CATALOG_PRICE_DIFF` and `PRODUCT_ARCHIVED`**; add `CATALOG_NAME_DIFF`, `CATEGORY_UNMAPPED`, `CATEGORY_INACTIVE`, `CURRENCY_UNSUPPORTED`, `NEGATIVE_QUANTITY`, `SKU_COLLISION` in the same house style |

This is a documentation correction, not a decision reversal — every §11/§10 _behaviour_ the
contract locked is preserved; only the string literals change. If approved, the contract doc
and the schema doc-comments are updated together in this PR so one vocabulary exists.

**Ruling required.**

### Two smaller corrections, no ruling needed

- `createProduct` is `(userId, dto, context: AuditContext)` — three parameters, not two. The
  extracted method threads `AuditContext` through.
- `createProduct` deliberately creates inventory with `trackInventory: false`, documented as
  _"Minimal merchants don't manage unit counts"_. A POS-ingested product **is** unit-tracked,
  so ingestion sets `trackInventory: true`. The extracted core takes this as a parameter
  rather than hardcoding either default.

---

## Part 2 — How decision #8 works with `IntegrationLog` as it exists

`IntegrationLog` is HTTP-request-shaped: `endpoint`, `method`, `requestBody`, `responseStatus`,
`responseBody`, `errorMessage`, `ipAddress`, `correlationId`. It has **no job reference and no
SKU column**, so per-item failures written naively would be unqueryable.

`correlationId` is `VarChar(64)` and a `CatalogSyncJob.id` is a 36-character UUID. Setting
`correlationId = catalogSyncJob.id` on every per-item failure row makes them retrievable per
job through the existing `@@index([integrationId, createdAt])`, with the SKU and reason in
`errorMessage`. Decision #8 is implementable on the model as-is; no new table.

---

## Part 3 — Schema changes

**Two**, not one. Decision #3 approved `CatalogSyncJob.idempotencyKey`; decision #6 approved a
dedicated category-mapping model, which is a second addition. Both are approved; the contract
text said "the one schema addition" before decision #6 was settled.

```prisma
model CatalogSyncJob {
  // …existing fields…
  /// Idempotency key from the external system — a replayed batch returns the
  /// original job rather than re-running. Mirrors InventoryUpdate.
  idempotencyKey String? @map("idempotency_key") @db.VarChar(100)

  @@unique([integrationId, idempotencyKey])
}

/// Maps an external POS category name to a DrippleX Category.
/// A POS must never create a Category: Category.slug is globally unique, so one
/// merchant's POS naming a category would claim that slug platform-wide.
model CategoryMapping {
  id                   String   @id @default(uuid()) @db.Uuid
  integrationId        String   @map("integration_id") @db.Uuid
  /// Category name exactly as the POS sends it
  externalCategoryName String   @map("external_category_name") @db.VarChar(255)
  categoryId           String   @map("category_id") @db.Uuid
  createdAt            DateTime @default(now()) @map("created_at")
  updatedAt            DateTime @updatedAt @map("updated_at")

  /// RESTRICT: a mapping records how a catalogue was interpreted; disconnecting
  /// an integration must not erase it. Consistent with every other child here.
  integration          MerchantIntegration @relation(fields: [integrationId], references: [id], onDelete: Restrict)
  /// RESTRICT: deleting a mapped Category would silently unmap a live catalogue.
  category             Category            @relation(fields: [categoryId], references: [id], onDelete: Restrict)

  @@unique([integrationId, externalCategoryName])
  @@index([categoryId])
  @@map("category_mappings")
}
```

`idempotencyKey` is nullable so the column is additive over existing rows. Both changes are
additive; nothing is dropped, renamed, or retyped. Migration generated with
`prisma migrate diff --from-migrations --to-schema-datamodel` against a shadow database, per
the standard already used in this repo — never hand-written.

---

## Part 4 — Diff scope

Branch: **`claude/mkt-int-001-p1-catalogue-ingestion`**, cut from `main` @ `3b63c28`.

### Modified — 3 files

| File                                                     | Change                                                                                                                                                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/backend/prisma/schema.prisma`                      | `CatalogSyncJob.idempotencyKey` + unique index; `CategoryMapping` model; `Category.mappings` back-relation; doc-comment vocabulary alignment (Finding 3)                                                     |
| `apps/backend/src/products/merchant-products.service.ts` | Extract `createProductForMerchant(merchantId, dto, context, opts)`; `createProduct(userId, …)` becomes a thin wrapper that resolves the profile and delegates. **No behaviour change on the existing path.** |
| `apps/backend/src/integrations/integrations.module.ts`   | Register the new controller, guard and services; import `ProductsModule`                                                                                                                                     |

### Added — production code, 6 files

| File                                                       | Responsibility                                                                                                                         |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/migrations/<ts>_catalogue_ingestion/migration.sql` | Generated, not hand-written                                                                                                            |
| `integrations/guards/integration-credential.guard.ts`      | Finding 2 — authenticates an incoming POS request via `verifyIncomingCredential`, resolves the integration, attaches it to the request |
| `integrations/services/catalogue-ingestion.service.ts`     | The ingestion engine: job lifecycle, per-item upsert, conflict raising, inventory application                                          |
| `integrations/services/category-mapping.service.ts`        | Decision #6 — resolve an external category name to a `Category`; never create one                                                      |
| `integrations/controllers/catalogue-sync.controller.ts`    | Decision #5 — the push endpoint plus a merchant-facing job-status read                                                                 |
| `integrations/dtos/ingest-catalogue.dto.ts`                | Payload validation: SKU, name, price, currency, quantity, category, active flag                                                        |

### Added — tests, 5 files

`catalogue-ingestion.service.spec.ts` · `category-mapping.service.spec.ts` ·
`integration-credential.guard.spec.ts` · `catalogue-sync-routes.spec.ts` (mirrors the existing
`integration-routes.spec.ts`, asserting the global prefix is not repeated) ·
`merchant-products.service.spec.ts` extended to prove the wrapper is unchanged.

### Explicitly not touched

`apps/customer-mobile/**` · `apps/customer-web/**` · `apps/merchant-portal/**` ·
`apps/rider-portal/**` · `apps/operations-console/**` · `packages/sdk/**` · any wallet, ledger,
order or B8 file · the shadowed legacy `integrations-c.controller.ts` · permission names ·
`.github/workflows/**`.

The Capacitor shell loads `https://app.dripplex.com` as a remote URL
(`apps/customer-mobile/capacitor.config.ts:20`), so any customer-web change would reach
devices — including a Play reviewer's — on merge. This diff contains none.

---

## Part 5 — Behaviour, mapped to the locked decisions

| Step             | Decision     | Behaviour                                                                                                                                                 |
| ---------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authenticate     | #5           | Guard verifies the credential, resolves `MerchantIntegration`, rejects archived/expired                                                                   |
| Resolve merchant | Finding 1    | `integration.merchantId` (a user id) → `MerchantProfile.id`; job fails cleanly if absent                                                                  |
| Open job         | #3           | Replay of a seen `idempotencyKey` returns the original job without re-running; else `PENDING` → `IN_PROGRESS`                                             |
| Per item         | #1           | Upsert `ProductSync` on `(integrationId, externalSku)`; one `Product` per external SKU — variants flattened                                               |
| Stale mapping    | contract §1  | A `productId` that no longer resolves is remapped, never treated as existing                                                                              |
| Category         | #6           | `CategoryMapping` lookup; unmapped ⇒ `categoryId` null + `CATEGORY_UNMAPPED`; never creates a `Category`                                                  |
| Price            | contract §4  | Non-NGN ⇒ reject item + `CURRENCY_UNSUPPORTED`; >2 decimals ⇒ reject, never round                                                                         |
| Status           | #7           | New products `DRAFT` unless the integration's `autoPublish` is on — read from `MerchantIntegration.metadata`, **default off**                             |
| Inventory        | contract §6  | Absolute quantity → `ProductInventory.quantity` only; **`reserved` never written**; one `StockMovement` `ADJUSTMENT` with `referenceType = 'INTEGRATION'` |
| Deletes          | contract §7  | Never hard-deleted; `ARCHIVED` + `isDeleted`; absence needs two consecutive full syncs                                                                    |
| Conflicts        | #4           | Raise-and-hold: a diverged field keeps the DrippleX value, conflict `OPEN`; other fields on the same product still sync                                   |
| Item failure     | #8           | Skip the item, `IntegrationLog` with `correlationId = job.id`, continue                                                                                   |
| Close job        | contract §11 | `COMPLETED` / `PARTIAL` / `FAILED`; `productCount` = items applied, not received; `AuditLog` on both transitions                                          |

`autoPublish` lives in `MerchantIntegration.metadata` (a `Json?` column that already exists)
rather than a new column — decision #7 approved the behaviour, and the existing column carries
it without a third schema change.

---

## Part 6 — Verification

Per CLAUDE.md §5, DB-touching behaviour is verified against real Postgres, not mocks.

1. `prisma migrate diff` proves schema and migrations agree (the parity check already in CI)
2. Unit specs for ingestion, mapping and the guard
3. Integration specs against real Postgres: replayed batch does not double-apply; `reserved`
   survives an ingestion that changes `quantity`; a diverged price does not overwrite; an
   unmapped category ingests with a conflict rather than failing the batch
4. Route spec proving no doubled `/api/v1/api/v1/` prefix
5. Full `Typecheck · Lint · Test · Build` green before review

Any pre-existing or unrelated failure is reported separately, never folded into a pass headline.

---

## Open before code is written

1. **Finding 1** — approve resolving `MerchantProfile` at ingestion (option A), with the
   decorator fix recorded as a follow-up rather than done here.
2. **Finding 3** — approve using the schema's existing vocabulary and updating the contract doc
   to match, so only one set of literals exists.

Finding 2 needs no ruling — the guard is required by approved decision #5 — but it is listed so
its presence in the diff is expected rather than a surprise.
