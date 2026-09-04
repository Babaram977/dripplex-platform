-- MKT-INT-001 Merchant Integration Platform — Database Foundation
--
-- Creates 8 new tables for merchant POS integration:
-- 1. merchant_integrations — configured integrations per merchant
-- 2. integration_credentials — scoped API credentials
-- 3. integration_logs — audit trail of all API activity
-- 4. integration_conflicts — reconciliation conflicts requiring review
-- 5. catalog_sync_jobs — batch catalog synchronization tracking
-- 6. product_syncs — SKU ↔ Product mappings
-- 7. inventory_updates — inventory change events
-- 8. order_status_updates — external order status updates
--
-- All soft-delete only (archived_at timestamp, no destructive DELETE).
-- Idempotency via idempotencyKey fields (UUID from external system).
-- Multi-tenant isolation via merchant_id scoping.

-- ──────────────────────────────────────────────────────────────────────────────
-- merchant_integrations
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE "merchant_integrations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "merchant_id" UUID NOT NULL,
  "integration_name" VARCHAR(150) NOT NULL,
  "pos_provider" VARCHAR(100) NOT NULL,
  "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  "webhook_url" VARCHAR(2048),
  "credential_id" UUID,
  "last_synced_at" TIMESTAMP(3),
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "merchant_integrations_merchant_id_idx" ON "merchant_integrations"("merchant_id");
CREATE INDEX "merchant_integrations_status_idx" ON "merchant_integrations"("status");
CREATE INDEX "merchant_integrations_archived_at_idx" ON "merchant_integrations"("archived_at");

-- ──────────────────────────────────────────────────────────────────────────────
-- integration_credentials
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE "integration_credentials" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "integration_id" UUID NOT NULL,
  "credential_hash" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "expires_at" TIMESTAMP(3),
  "rotated_at" TIMESTAMP(3),
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integration_credentials_integration_id_fk"
    FOREIGN KEY ("integration_id")
    REFERENCES "merchant_integrations"("id")
    ON DELETE CASCADE
);

CREATE INDEX "integration_credentials_integration_id_idx" ON "integration_credentials"("integration_id");
CREATE INDEX "integration_credentials_expires_at_idx" ON "integration_credentials"("expires_at");
CREATE INDEX "integration_credentials_archived_at_idx" ON "integration_credentials"("archived_at");

-- Add foreign key to merchant_integrations
ALTER TABLE "merchant_integrations"
  ADD CONSTRAINT "merchant_integrations_credential_id_fk"
  FOREIGN KEY ("credential_id")
  REFERENCES "integration_credentials"("id")
  ON DELETE SET NULL;

-- ──────────────────────────────────────────────────────────────────────────────
-- integration_logs
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE "integration_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "integration_id" UUID NOT NULL,
  "endpoint" VARCHAR(255) NOT NULL,
  "method" VARCHAR(10) NOT NULL,
  "request_body" TEXT,
  "response_status" INTEGER,
  "response_body" TEXT,
  "error_message" TEXT,
  "ip_address" VARCHAR(45),
  "correlation_id" VARCHAR(64),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integration_logs_integration_id_fk"
    FOREIGN KEY ("integration_id")
    REFERENCES "merchant_integrations"("id")
    ON DELETE RESTRICT
);

CREATE INDEX "integration_logs_integration_id_created_at_idx" ON "integration_logs"("integration_id", "created_at" DESC);
CREATE INDEX "integration_logs_response_status_idx" ON "integration_logs"("response_status");

-- ──────────────────────────────────────────────────────────────────────────────
-- integration_conflicts
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE "integration_conflicts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "integration_id" UUID NOT NULL,
  "conflict_type" VARCHAR(100) NOT NULL,
  "source_id" UUID,
  "external_id" VARCHAR(255),
  "dripplex_value" TEXT,
  "external_value" TEXT,
  "status" VARCHAR(50) NOT NULL DEFAULT 'OPEN',
  "resolution" VARCHAR(1000),
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integration_conflicts_integration_id_fk"
    FOREIGN KEY ("integration_id")
    REFERENCES "merchant_integrations"("id")
    ON DELETE RESTRICT
);

CREATE INDEX "integration_conflicts_integration_id_status_idx" ON "integration_conflicts"("integration_id", "status");
CREATE INDEX "integration_conflicts_conflict_type_idx" ON "integration_conflicts"("conflict_type");
CREATE INDEX "integration_conflicts_status_idx" ON "integration_conflicts"("status");

-- ──────────────────────────────────────────────────────────────────────────────
-- catalog_sync_jobs
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE "catalog_sync_jobs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "integration_id" UUID NOT NULL,
  "job_status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  "sync_direction" VARCHAR(50) NOT NULL,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "product_count" INTEGER NOT NULL DEFAULT 0,
  "failure_reason" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "catalog_sync_jobs_integration_id_fk"
    FOREIGN KEY ("integration_id")
    REFERENCES "merchant_integrations"("id")
    ON DELETE RESTRICT
);

CREATE INDEX "catalog_sync_jobs_integration_id_job_status_idx" ON "catalog_sync_jobs"("integration_id", "job_status");
CREATE INDEX "catalog_sync_jobs_job_status_idx" ON "catalog_sync_jobs"("job_status");
CREATE INDEX "catalog_sync_jobs_completed_at_idx" ON "catalog_sync_jobs"("completed_at");

-- ──────────────────────────────────────────────────────────────────────────────
-- product_syncs
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE "product_syncs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "integration_id" UUID NOT NULL,
  "external_sku" VARCHAR(100) NOT NULL,
  "product_id" UUID,
  "last_synced_at" TIMESTAMP(3),
  "mapping_status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  "external_catalog_id" VARCHAR(100),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_syncs_integration_id_fk"
    FOREIGN KEY ("integration_id")
    REFERENCES "merchant_integrations"("id")
    ON DELETE RESTRICT,
  CONSTRAINT "product_syncs_integration_id_external_sku_unique"
    UNIQUE ("integration_id", "external_sku")
);

CREATE INDEX "product_syncs_integration_id_mapping_status_idx" ON "product_syncs"("integration_id", "mapping_status");
CREATE INDEX "product_syncs_product_id_idx" ON "product_syncs"("product_id");

-- ──────────────────────────────────────────────────────────────────────────────
-- inventory_updates
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE "inventory_updates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "integration_id" UUID NOT NULL,
  "product_sync_id" UUID NOT NULL,
  "external_sku" VARCHAR(100) NOT NULL,
  "previous_quantity" INTEGER NOT NULL,
  "new_quantity" INTEGER NOT NULL,
  "is_soft_delete" BOOLEAN NOT NULL DEFAULT FALSE,
  "source_type" VARCHAR(50) NOT NULL,
  "delivery_status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "last_attempt_at" TIMESTAMP(3),
  "idempotency_key" VARCHAR(100) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_updates_integration_id_fk"
    FOREIGN KEY ("integration_id")
    REFERENCES "merchant_integrations"("id")
    ON DELETE RESTRICT,
  CONSTRAINT "inventory_updates_product_sync_id_fk"
    FOREIGN KEY ("product_sync_id")
    REFERENCES "product_syncs"("id")
    ON DELETE RESTRICT,
  CONSTRAINT "inventory_updates_integration_id_idempotency_key_unique"
    UNIQUE ("integration_id", "idempotency_key")
);

CREATE INDEX "inventory_updates_integration_id_delivery_status_idx" ON "inventory_updates"("integration_id", "delivery_status");
CREATE INDEX "inventory_updates_product_sync_id_idx" ON "inventory_updates"("product_sync_id");

-- ──────────────────────────────────────────────────────────────────────────────
-- order_status_updates
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE "order_status_updates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "integration_id" UUID NOT NULL,
  "external_order_id" VARCHAR(255) NOT NULL,
  "internal_order_id" UUID,
  "previous_status" VARCHAR(50),
  "new_status" VARCHAR(50) NOT NULL,
  "source_timestamp" TIMESTAMP(3) NOT NULL,
  "processed_at" TIMESTAMP(3),
  "reconciliation_status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  "idempotency_key" VARCHAR(100) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_status_updates_integration_id_fk"
    FOREIGN KEY ("integration_id")
    REFERENCES "merchant_integrations"("id")
    ON DELETE RESTRICT,
  CONSTRAINT "order_status_updates_integration_id_idempotency_key_unique"
    UNIQUE ("integration_id", "idempotency_key")
);

CREATE INDEX "order_status_updates_integration_id_reconciliation_status_idx" ON "order_status_updates"("integration_id", "reconciliation_status");
CREATE INDEX "order_status_updates_internal_order_id_idx" ON "order_status_updates"("internal_order_id");
