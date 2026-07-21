-- S1-C3: login and session foundation

ALTER TABLE "users" ADD COLUMN "last_active_at" TIMESTAMP(3);

ALTER TABLE "auth_sessions" ALTER COLUMN "refresh_token_hash" DROP NOT NULL;

ALTER TABLE "auth_sessions" ADD COLUMN "portal" "RegistrationChannel";

ALTER TABLE "auth_sessions" ADD COLUMN "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "auth_sessions"
SET "portal" = 'CUSTOMER_WEB'
WHERE "portal" IS NULL;

ALTER TABLE "auth_sessions" ALTER COLUMN "portal" SET NOT NULL;

CREATE INDEX "auth_sessions_portal_idx" ON "auth_sessions"("portal");
