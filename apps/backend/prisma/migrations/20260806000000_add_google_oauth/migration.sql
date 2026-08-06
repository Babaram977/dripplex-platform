-- Google Sign-In: founder-authorized production feature.
-- New registration channel for Google-originated customer signups, and a
-- unique, nullable google_id on users for lookup/linking. Unrelated
-- statements, safe to combine in one migration.

-- AlterEnum
ALTER TYPE "RegistrationChannel" ADD VALUE 'CUSTOMER_WEB_GOOGLE';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "google_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");
