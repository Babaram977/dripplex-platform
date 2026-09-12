/**
 * The string vocabulary for catalogue ingestion.
 *
 * `CatalogSyncJob.jobStatus`, `syncDirection`, `InventoryUpdate.deliveryStatus`
 * and `IntegrationConflict.conflictType` are all `VarChar` columns with no
 * enum, so the values live here rather than being spelled inline. The
 * Catalogue Ingestion Contract originally named a second set of literals
 * (`FROM_EXTERNAL`, `RUNNING`, `SUCCEEDED`, `APPLIED`, `PRICE_DIVERGED`);
 * that was corrected to the vocabulary the schema already documents, so only
 * one set exists. See the contract amendment for the ruling.
 */

/** `CatalogSyncJob.jobStatus`. PARTIAL is the one genuinely new value. */
export const CATALOG_SYNC_JOB_STATUS = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  /** Ran to completion, every item applied. */
  COMPLETED: 'COMPLETED',
  /** Ran to completion, some items rejected. Per-item detail in IntegrationLog. */
  PARTIAL: 'PARTIAL',
  /** Aborted before or during the run; nothing usable was produced. */
  FAILED: 'FAILED',
} as const;

/** `CatalogSyncJob.syncDirection`. Phase 1 ingests only. */
export const SYNC_DIRECTION = {
  POS_TO_DRIPPLEX: 'POS_TO_DRIPPLEX',
  DRIPPLEX_TO_POS: 'DRIPPLEX_TO_POS',
} as const;

/**
 * `InventoryUpdate.deliveryStatus`. The column describes delivery of an
 * OUTBOUND update to a POS. An inbound row has nothing to deliver — it is
 * already applied — so it is recorded as DELIVERED with `attemptCount` 0, and
 * `sourceType` carries the direction. Reusing the existing values rather than
 * inventing an APPLIED state was decision #9.
 */
export const INVENTORY_DELIVERY_STATUS = {
  PENDING: 'PENDING',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
} as const;

/** `InventoryUpdate.sourceType`. Push-only in Phase 1, so inbound is WEBHOOK. */
export const INVENTORY_SOURCE_TYPE = {
  WEBHOOK: 'WEBHOOK',
  API_POLL: 'API_POLL',
} as const;

/**
 * `IntegrationConflict.conflictType`. The first three already existed in the
 * schema's documented set; the rest follow the same house style.
 */
export const CONFLICT_TYPE = {
  /** External price differs from a DrippleX price a merchant has since edited. */
  CATALOG_PRICE_DIFF: 'CATALOG_PRICE_DIFF',
  /** External name differs from a DrippleX name a merchant has since edited. */
  CATALOG_NAME_DIFF: 'CATALOG_NAME_DIFF',
  /** The POS reports the product as removed at source. */
  PRODUCT_ARCHIVED: 'PRODUCT_ARCHIVED',
  /** A mapped product was absent from a full sync — not treated as a delete. */
  PRODUCT_ABSENT: 'PRODUCT_ABSENT',
  /** No CategoryMapping for the POS's category name. Product ingests uncategorised. */
  CATEGORY_UNMAPPED: 'CATEGORY_UNMAPPED',
  /** Mapped to a Category that is no longer active. */
  CATEGORY_INACTIVE: 'CATEGORY_INACTIVE',
  /** A currency DrippleX cannot price in. The item is rejected, never converted. */
  CURRENCY_UNSUPPORTED: 'CURRENCY_UNSUPPORTED',
  /** The POS sent a negative quantity. Clamped to zero and recorded. */
  NEGATIVE_QUANTITY: 'NEGATIVE_QUANTITY',
  /** One external SKU resolved to more than one DrippleX product. */
  SKU_COLLISION: 'SKU_COLLISION',
} as const;

/** `ProductSync.mappingStatus`. */
export const MAPPING_STATUS = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
  FAILED: 'FAILED',
} as const;

/**
 * The only currency DrippleX prices in. `Product.currency` defaults to NGN and
 * there is no FX source anywhere in the platform.
 */
export const SUPPORTED_CURRENCY = 'NGN';

/**
 * The scope an incoming credential must carry to push a catalogue. Drawn from
 * the set already documented on `IntegrationCredential.scopes`.
 */
export const CATALOGUE_WRITE_SCOPE = 'catalog:write';

/**
 * The scope an incoming credential must carry to push stock levels. Separate
 * from catalogue write on purpose: a till that only reports counts has no
 * business rewriting names and prices.
 *
 * Already in the documented set on `IntegrationCredential.scopes` and already
 * granted by default when an integration is created, so no existing credential
 * has to be reissued for the inventory route to be reachable.
 */
export const INVENTORY_WRITE_SCOPE = 'inventory:write';

/** Audit actions recorded for a sync job's lifecycle transitions. */
export const CATALOGUE_SYNC_AUDIT_ACTIONS = {
  JOB_STARTED: 'integration.catalogue.sync.started',
  JOB_FINISHED: 'integration.catalogue.sync.finished',
} as const;

/** Audit action recorded for one inventory push. */
export const INVENTORY_SYNC_AUDIT_ACTIONS = {
  BATCH_APPLIED: 'integration.inventory.sync.applied',
} as const;

/**
 * Why one item of an inventory push was not applied.
 *
 * Deliberately NOT `IntegrationConflict.conflictType` values. A conflict is a
 * disagreement between two systems that a merchant has to settle; an unmapped
 * SKU is simply an item this integration has never catalogued, and inventing
 * conflict types for it would put values in a live audit table that no
 * approved contract names. These travel in the response and in
 * `IntegrationLog`, where per-item detail already lives (decision #8).
 */
export const INVENTORY_REJECTION = {
  /** No ProductSync for (integration, externalSku) — the SKU was never catalogued. */
  SKU_NOT_MAPPED: 'SKU_NOT_MAPPED',
  /** A mapping exists but carries no productId — an interrupted catalogue batch. */
  SKU_NOT_LINKED: 'SKU_NOT_LINKED',
  /** The mapping is not ACTIVE, so it no longer accepts stock. */
  MAPPING_INACTIVE: 'MAPPING_INACTIVE',
  /** The mapped product is deleted, or belongs to a different merchant. */
  PRODUCT_UNAVAILABLE: 'PRODUCT_UNAVAILABLE',
  /** The same externalSku appeared twice in one batch. */
  DUPLICATE_IN_BATCH: 'DUPLICATE_IN_BATCH',
} as const;
