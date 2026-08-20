-- What a merchant SELLS, as opposed to how it is legally constituted.
--
-- BusinessType is a legal structure (SOLE_PROPRIETORSHIP, PARTNERSHIP), so the
-- marketplace had nothing to filter on: its category chips fell back to a
-- free-text search of merchant NAMES, and the storefront-icon lookup could
-- never match, which is why every merchant card drew the same default glyph.
--
-- Additive and nullable. Every existing merchant keeps working and simply has
-- no category until one is set; an uncategorised merchant still appears under
-- "All". A wrong guessed value would be worse than an honest blank.

CREATE TYPE "MerchantCategory" AS ENUM (
  'SUPERMARKET',
  'RESTAURANT',
  'PHARMACY',
  'ELECTRONICS',
  'FASHION',
  'BEAUTY',
  'HARDWARE',
  'HOTEL',
  'FURNITURE',
  'SERVICES',
  'WHOLESALE',
  'OTHER'
);

ALTER TABLE "businesses" ADD COLUMN "category" "MerchantCategory";

CREATE INDEX "businesses_category_idx" ON "businesses"("category");
