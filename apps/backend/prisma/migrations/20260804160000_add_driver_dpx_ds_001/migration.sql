-- DPX-DS-001: expanded driver identity-verification trigger set + lockout.
-- See docs/DRIVER-001-IDENTITY-VERIFICATION-DESIGN.md addendum.

-- Postgres cannot add multiple enum values inside one transaction in a single
-- ALTER TYPE ... ADD VALUE per statement pre-v12 semantics; each gets its own line.
ALTER TYPE "DriverVerificationTrigger" ADD VALUE 'CREDENTIAL_CHANGE';
ALTER TYPE "DriverVerificationTrigger" ADD VALUE 'FAILED_LOGIN_LOCKOUT';
ALTER TYPE "DriverVerificationTrigger" ADD VALUE 'FIRST_LOGIN_OF_DAY';
ALTER TYPE "DriverVerificationTrigger" ADD VALUE 'GPS_ANOMALY';
ALTER TYPE "DriverVerificationTrigger" ADD VALUE 'RANDOM_SPOT_CHECK';
ALTER TYPE "DriverVerificationTrigger" ADD VALUE 'PHONE_NUMBER_CHANGED';

-- AlterTable
ALTER TABLE "driver_profiles"
  ADD COLUMN "failed_verification_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "identity_verification_locked_at" TIMESTAMP(3);
