-- Driver-001: risk-based facial/identity verification (Smile ID)

CREATE TYPE "IdentityVerificationProvider" AS ENUM ('SMILE_ID');

CREATE TYPE "DriverVerificationTrigger" AS ENUM (
  'ONBOARDING',
  'IDLE_TIMEOUT',
  'NEW_DEVICE',
  'SUSPICIOUS_ACTIVITY',
  'ACCOUNT_RECOVERY',
  'MANUAL_ADMIN'
);

CREATE TYPE "DriverVerificationStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'ERROR');

ALTER TABLE "driver_profiles"
  ADD COLUMN "last_identity_verified_at" TIMESTAMP(3),
  ADD COLUMN "identity_verification_required_reason" "DriverVerificationTrigger";

-- Backfill: every pre-existing driver counts as "just verified" so the new
-- gate applies only to trigger conditions occurring after this ships, not
-- retroactively. See docs/DRIVER-001-IDENTITY-VERIFICATION-DESIGN.md.
UPDATE "driver_profiles" SET "last_identity_verified_at" = now();

CREATE TABLE "driver_identity_verifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "driver_id" UUID NOT NULL,
  "provider" "IdentityVerificationProvider" NOT NULL,
  "trigger" "DriverVerificationTrigger" NOT NULL,
  "status" "DriverVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "confidence_score" DECIMAL(5,2),
  "provider_reference" VARCHAR(255),
  "device_id" VARCHAR(255),
  "ip_address" VARCHAR(45),
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "failure_reason" VARCHAR(1000),
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),

  CONSTRAINT "driver_identity_verifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "driver_identity_verifications_driver_id_created_at_idx"
  ON "driver_identity_verifications" ("driver_id", "created_at" DESC);
CREATE INDEX "driver_identity_verifications_status_idx"
  ON "driver_identity_verifications" ("status");

ALTER TABLE "driver_identity_verifications"
  ADD CONSTRAINT "driver_identity_verifications_driver_id_fkey"
  FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "driver_verified_devices" (
  "driver_id" UUID NOT NULL,
  "device_fingerprint" VARCHAR(64) NOT NULL,
  "first_verified_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "last_seen_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "driver_verified_devices_pkey" PRIMARY KEY ("driver_id", "device_fingerprint")
);

ALTER TABLE "driver_verified_devices"
  ADD CONSTRAINT "driver_verified_devices_driver_id_fkey"
  FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
