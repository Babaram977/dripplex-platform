-- S1-C8: Merchant & business onboarding (Business, KYC, BankAccount)

CREATE TYPE "MerchantStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED');

CREATE TYPE "BusinessStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACTIVE', 'SUSPENDED');

CREATE TYPE "BusinessVerificationStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED');

CREATE TYPE "BusinessType" AS ENUM ('SOLE_PROPRIETORSHIP', 'PARTNERSHIP', 'LIMITED_LIABILITY', 'CORPORATION', 'OTHER');

CREATE TYPE "KycDocumentType" AS ENUM ('NATIONAL_ID', 'PASSPORT', 'DRIVER_LICENSE', 'CAC_CERTIFICATE', 'BUSINESS_REGISTRATION');

CREATE TYPE "KycVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

ALTER TABLE "merchant_profiles" ADD COLUMN "status" "MerchantStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "merchant_profiles" ADD COLUMN "approved_by" UUID;
ALTER TABLE "merchant_profiles" ADD COLUMN "rejected_reason" VARCHAR(1000);
ALTER TABLE "merchant_profiles" ADD COLUMN "suspended_at" TIMESTAMP(3);

UPDATE "merchant_profiles"
SET "status" = CASE
  WHEN "is_approved" = true THEN 'APPROVED'::"MerchantStatus"
  ELSE 'PENDING'::"MerchantStatus"
END;

CREATE INDEX "merchant_profiles_status_idx" ON "merchant_profiles"("status");

CREATE TABLE "businesses" (
    "id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "business_name" VARCHAR(150) NOT NULL,
    "business_type" "BusinessType" NOT NULL,
    "registration_number" VARCHAR(100) NOT NULL,
    "tax_number" VARCHAR(100),
    "description" VARCHAR(2000),
    "email" CITEXT NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "country" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "address" VARCHAR(500) NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "logo_url" VARCHAR(2048),
    "cover_photo_url" VARCHAR(2048),
    "status" "BusinessStatus" NOT NULL DEFAULT 'DRAFT',
    "verification_status" "BusinessVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "rejected_reason" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "businesses_merchant_id_key" ON "businesses"("merchant_id");
CREATE UNIQUE INDEX "businesses_registration_number_key" ON "businesses"("registration_number");
CREATE INDEX "businesses_status_idx" ON "businesses"("status");
CREATE INDEX "businesses_verification_status_idx" ON "businesses"("verification_status");
CREATE INDEX "businesses_country_state_idx" ON "businesses"("country", "state");
CREATE INDEX "businesses_created_at_idx" ON "businesses"("created_at");

ALTER TABLE "businesses" ADD CONSTRAINT "businesses_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "merchant_kyc" (
    "id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "document_type" "KycDocumentType" NOT NULL,
    "document_number" VARCHAR(100) NOT NULL,
    "front_image" VARCHAR(2048) NOT NULL,
    "back_image" VARCHAR(2048),
    "selfie_image" VARCHAR(2048),
    "verification_status" "KycVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "remarks" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_kyc_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "merchant_kyc_merchant_id_idx" ON "merchant_kyc"("merchant_id");
CREATE INDEX "merchant_kyc_business_id_idx" ON "merchant_kyc"("business_id");
CREATE INDEX "merchant_kyc_verification_status_idx" ON "merchant_kyc"("verification_status");
CREATE INDEX "merchant_kyc_merchant_id_verification_status_idx" ON "merchant_kyc"("merchant_id", "verification_status");

ALTER TABLE "merchant_kyc" ADD CONSTRAINT "merchant_kyc_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "merchant_kyc" ADD CONSTRAINT "merchant_kyc_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "bank_accounts" (
    "id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "bank_name" VARCHAR(150) NOT NULL,
    "account_name" VARCHAR(150) NOT NULL,
    "account_number" VARCHAR(20) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'NGN',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bank_accounts_merchant_id_idx" ON "bank_accounts"("merchant_id");
CREATE INDEX "bank_accounts_merchant_id_is_default_idx" ON "bank_accounts"("merchant_id", "is_default");
CREATE UNIQUE INDEX "bank_accounts_merchant_id_account_number_key" ON "bank_accounts"("merchant_id", "account_number");

ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
