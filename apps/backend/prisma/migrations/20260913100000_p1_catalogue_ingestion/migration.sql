-- Phase 1 Catalogue Ingestion — the two schema additions approved in the
-- Catalogue Ingestion Contract (docs/DPX-MKT-INT-001-P1-CATALOGUE-CONTRACT.md).
--
--   Decision #3: catalog_sync_jobs.idempotency_key + unique index, so a
--                replayed batch returns the original job instead of re-running.
--   Decision #6: category_mappings, so a POS resolves to an existing Category
--                and can never create one (Category.slug is globally unique).
--
-- Both are additive: one nullable column, one new table. Nothing is dropped,
-- renamed or retyped, so this applies cleanly over existing rows.
-- Generated with prisma migrate diff --from-migrations --to-schema-datamodel.

-- AlterTable
ALTER TABLE "catalog_sync_jobs" ADD COLUMN     "idempotency_key" VARCHAR(100);

-- CreateTable
CREATE TABLE "category_mappings" (
    "id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "external_category_name" VARCHAR(255) NOT NULL,
    "category_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "category_mappings_category_id_idx" ON "category_mappings"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "category_mappings_integration_id_external_category_name_key" ON "category_mappings"("integration_id", "external_category_name");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_sync_jobs_integration_id_idempotency_key_key" ON "catalog_sync_jobs"("integration_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "category_mappings" ADD CONSTRAINT "category_mappings_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "merchant_integrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_mappings" ADD CONSTRAINT "category_mappings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

