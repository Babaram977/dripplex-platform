-- MKT-INT-001-C: Add API contract fields to merchant_integrations
--
-- The C phase API contract specifies vendorName, vendorVersion, merchantContactEmail, and metadata
-- Add these fields to support the canonical C endpoint contract

-- Add new columns for C API contract fields
ALTER TABLE "merchant_integrations"
  ADD COLUMN "vendor_name" VARCHAR(100),
  ADD COLUMN "vendor_version" VARCHAR(100),
  ADD COLUMN "merchant_contact_email" VARCHAR(255),
  ADD COLUMN "metadata" JSONB;

-- Backfill vendor_name from integration_name (required field mapping)
UPDATE "merchant_integrations"
SET "vendor_name" = "integration_name"
WHERE "vendor_name" IS NULL;

-- Make vendor_name NOT NULL after backfill
ALTER TABLE "merchant_integrations"
  ALTER COLUMN "vendor_name" SET NOT NULL;

-- Add index for vendor_name lookups
CREATE INDEX "merchant_integrations_vendor_name_idx" ON "merchant_integrations"("vendor_name");
