-- DPX-REVIEWS-001 — review tags + author role (customer vs merchant).

-- CreateEnum
CREATE TYPE "ReviewAuthorRole" AS ENUM ('CUSTOMER', 'MERCHANT');

-- AlterTable
ALTER TABLE "reviews"
  ADD COLUMN "author_role" "ReviewAuthorRole" NOT NULL DEFAULT 'CUSTOMER',
  ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
