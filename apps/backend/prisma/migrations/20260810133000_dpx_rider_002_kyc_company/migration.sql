-- DPX-RIDER-002 — delivery-rider document KYC (ID + guarantor ID) and the
-- company/organisation name the rider delivers for.

-- AlterTable
ALTER TABLE "rider_profiles" ADD COLUMN "company_name" VARCHAR(200);

-- CreateTable
CREATE TABLE "rider_kyc" (
    "id" UUID NOT NULL,
    "rider_id" UUID NOT NULL,
    "document_type" "KycDocumentType" NOT NULL,
    "document_number" VARCHAR(100) NOT NULL,
    "front_image" VARCHAR(2048) NOT NULL,
    "back_image" VARCHAR(2048),
    "verification_status" "KycVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "remarks" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rider_kyc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rider_kyc_rider_id_idx" ON "rider_kyc"("rider_id");

-- CreateIndex
CREATE INDEX "rider_kyc_verification_status_idx" ON "rider_kyc"("verification_status");

-- AddForeignKey
ALTER TABLE "rider_kyc" ADD CONSTRAINT "rider_kyc_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
