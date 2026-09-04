-- MKT-INT-001-B: Add credential type field to support incoming vs outbound credentials

ALTER TABLE "integration_credentials"
  ADD COLUMN "credential_type" VARCHAR(50) NOT NULL DEFAULT 'OUTGOING_OAUTH_TOKEN';

-- Create unique constraint on (integration_id, credential_type)
CREATE UNIQUE INDEX "integration_credentials_integration_id_credential_type_unique"
  ON "integration_credentials"("integration_id", "credential_type");

-- Create index for credential type queries
CREATE INDEX "integration_credentials_credential_type_idx"
  ON "integration_credentials"("credential_type");

-- Remove default after backfill (no existing data, safe to remove default)
-- All new credentials MUST explicitly specify type
ALTER TABLE "integration_credentials"
  ALTER COLUMN "credential_type" DROP DEFAULT;
