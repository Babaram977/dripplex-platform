-- S1-C6: Identity verification challenges (email signed token + phone OTP)

CREATE TYPE "IdentityVerificationType" AS ENUM ('EMAIL', 'PHONE');

CREATE TABLE "identity_verifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "IdentityVerificationType" NOT NULL,
    "token_hash" VARCHAR(64),
    "otp_hash" VARCHAR(64),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identity_verifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "identity_verifications_token_hash_key" ON "identity_verifications"("token_hash");

CREATE INDEX "identity_verifications_user_id_type_idx" ON "identity_verifications"("user_id", "type");

CREATE INDEX "identity_verifications_user_id_type_consumed_at_idx" ON "identity_verifications"("user_id", "type", "consumed_at");

CREATE INDEX "identity_verifications_otp_hash_idx" ON "identity_verifications"("otp_hash");

CREATE INDEX "identity_verifications_expires_at_idx" ON "identity_verifications"("expires_at");

ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
