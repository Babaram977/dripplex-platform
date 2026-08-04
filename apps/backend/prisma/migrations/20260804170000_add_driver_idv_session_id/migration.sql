-- Driver-001 Security Standard audit field #9 (session ID): the AuthSession
-- behind the caller's access token at verification-submit time.
-- See docs/DRIVER-001-IDENTITY-VERIFICATION-DESIGN.md.

-- AlterTable
ALTER TABLE "driver_identity_verifications" ADD COLUMN "session_id" UUID;
