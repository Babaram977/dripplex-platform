-- S1-C2: onboarding and audit tables for registration & verification foundation

CREATE TYPE "OnboardingStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(150) NOT NULL,
    "resource" VARCHAR(100),
    "resource_id" UUID,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(512),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "merchant_onboarding" (
    "id" UUID NOT NULL,
    "merchant_profile_id" UUID NOT NULL,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_onboarding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rider_onboarding" (
    "id" UUID NOT NULL,
    "rider_profile_id" UUID NOT NULL,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rider_onboarding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "driver_onboarding" (
    "id" UUID NOT NULL,
    "driver_profile_id" UUID NOT NULL,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_onboarding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "merchant_onboarding_merchant_profile_id_key" ON "merchant_onboarding"("merchant_profile_id");
CREATE INDEX "merchant_onboarding_status_idx" ON "merchant_onboarding"("status");

CREATE UNIQUE INDEX "rider_onboarding_rider_profile_id_key" ON "rider_onboarding"("rider_profile_id");
CREATE INDEX "rider_onboarding_status_idx" ON "rider_onboarding"("status");

CREATE UNIQUE INDEX "driver_onboarding_driver_profile_id_key" ON "driver_onboarding"("driver_profile_id");
CREATE INDEX "driver_onboarding_status_idx" ON "driver_onboarding"("status");

CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at" DESC);
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at" DESC);

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "merchant_onboarding" ADD CONSTRAINT "merchant_onboarding_merchant_profile_id_fkey" FOREIGN KEY ("merchant_profile_id") REFERENCES "merchant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rider_onboarding" ADD CONSTRAINT "rider_onboarding_rider_profile_id_fkey" FOREIGN KEY ("rider_profile_id") REFERENCES "rider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "driver_onboarding" ADD CONSTRAINT "driver_onboarding_driver_profile_id_fkey" FOREIGN KEY ("driver_profile_id") REFERENCES "driver_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
