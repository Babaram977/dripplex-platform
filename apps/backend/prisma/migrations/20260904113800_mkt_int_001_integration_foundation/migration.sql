-- CreateTable
CREATE TABLE "merchant_integrations" (
    "id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "integration_name" VARCHAR(150) NOT NULL,
    "pos_provider" VARCHAR(100) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    "webhook_url" VARCHAR(2048),
    "credential_id" UUID,
    "last_synced_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "vendor_name" VARCHAR(100) NOT NULL DEFAULT '',
    "vendor_version" VARCHAR(100),
    "merchant_contact_email" VARCHAR(255),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_credentials" (
    "id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "credential_type" VARCHAR(50) NOT NULL,
    "credential_hash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expires_at" TIMESTAMP(3),
    "rotated_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_logs" (
    "id" UUID NOT NULL,
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

    CONSTRAINT "integration_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_conflicts" (
    "id" UUID NOT NULL,
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
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_sync_jobs" (
    "id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "job_status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "sync_direction" VARCHAR(50) NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "product_count" INTEGER NOT NULL DEFAULT 0,
    "failure_reason" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_syncs" (
    "id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "external_sku" VARCHAR(100) NOT NULL,
    "product_id" UUID,
    "last_synced_at" TIMESTAMP(3),
    "mapping_status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    "external_catalog_id" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_updates" (
    "id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "product_sync_id" UUID NOT NULL,
    "external_sku" VARCHAR(100) NOT NULL,
    "previous_quantity" INTEGER NOT NULL,
    "new_quantity" INTEGER NOT NULL,
    "is_soft_delete" BOOLEAN NOT NULL DEFAULT false,
    "source_type" VARCHAR(50) NOT NULL,
    "delivery_status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "idempotency_key" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_updates" (
    "id" UUID NOT NULL,
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
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_status_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "merchant_integrations_merchant_id_idx" ON "merchant_integrations"("merchant_id");

-- CreateIndex
CREATE INDEX "merchant_integrations_status_idx" ON "merchant_integrations"("status");

-- CreateIndex
CREATE INDEX "merchant_integrations_archived_at_idx" ON "merchant_integrations"("archived_at");

-- CreateIndex
CREATE INDEX "merchant_integrations_vendor_name_idx" ON "merchant_integrations"("vendor_name");

-- CreateIndex
CREATE INDEX "integration_credentials_integration_id_idx" ON "integration_credentials"("integration_id");

-- CreateIndex
CREATE INDEX "integration_credentials_credential_type_idx" ON "integration_credentials"("credential_type");

-- CreateIndex
CREATE INDEX "integration_credentials_expires_at_idx" ON "integration_credentials"("expires_at");

-- CreateIndex
CREATE INDEX "integration_credentials_archived_at_idx" ON "integration_credentials"("archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "integration_credentials_integration_id_credential_type_key" ON "integration_credentials"("integration_id", "credential_type");

-- CreateIndex
CREATE INDEX "integration_logs_integration_id_created_at_idx" ON "integration_logs"("integration_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "integration_logs_response_status_idx" ON "integration_logs"("response_status");

-- CreateIndex
CREATE INDEX "integration_conflicts_integration_id_status_idx" ON "integration_conflicts"("integration_id", "status");

-- CreateIndex
CREATE INDEX "integration_conflicts_conflict_type_idx" ON "integration_conflicts"("conflict_type");

-- CreateIndex
CREATE INDEX "integration_conflicts_status_idx" ON "integration_conflicts"("status");

-- CreateIndex
CREATE INDEX "catalog_sync_jobs_integration_id_job_status_idx" ON "catalog_sync_jobs"("integration_id", "job_status");

-- CreateIndex
CREATE INDEX "catalog_sync_jobs_job_status_idx" ON "catalog_sync_jobs"("job_status");

-- CreateIndex
CREATE INDEX "catalog_sync_jobs_completed_at_idx" ON "catalog_sync_jobs"("completed_at");

-- CreateIndex
CREATE INDEX "product_syncs_integration_id_mapping_status_idx" ON "product_syncs"("integration_id", "mapping_status");

-- CreateIndex
CREATE INDEX "product_syncs_product_id_idx" ON "product_syncs"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_syncs_integration_id_external_sku_key" ON "product_syncs"("integration_id", "external_sku");

-- CreateIndex
CREATE INDEX "inventory_updates_integration_id_delivery_status_idx" ON "inventory_updates"("integration_id", "delivery_status");

-- CreateIndex
CREATE INDEX "inventory_updates_product_sync_id_idx" ON "inventory_updates"("product_sync_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_updates_integration_id_idempotency_key_key" ON "inventory_updates"("integration_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "order_status_updates_integration_id_reconciliation_status_idx" ON "order_status_updates"("integration_id", "reconciliation_status");

-- CreateIndex
CREATE INDEX "order_status_updates_internal_order_id_idx" ON "order_status_updates"("internal_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_status_updates_integration_id_idempotency_key_key" ON "order_status_updates"("integration_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "merchant_integrations" ADD CONSTRAINT "merchant_integrations_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "integration_credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_logs" ADD CONSTRAINT "integration_logs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "merchant_integrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_conflicts" ADD CONSTRAINT "integration_conflicts_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "merchant_integrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_sync_jobs" ADD CONSTRAINT "catalog_sync_jobs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "merchant_integrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_syncs" ADD CONSTRAINT "product_syncs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "merchant_integrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_updates" ADD CONSTRAINT "inventory_updates_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "merchant_integrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_updates" ADD CONSTRAINT "inventory_updates_product_sync_id_fkey" FOREIGN KEY ("product_sync_id") REFERENCES "product_syncs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_updates" ADD CONSTRAINT "order_status_updates_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "merchant_integrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

