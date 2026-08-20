-- Betting and education added to the utilities catalogue.
--
-- Entirely additive. Two new enum values, two new nullable columns, and one
-- column widened from VarChar(255) to text. Every existing purchase row keeps
-- working untouched, and a narrower->wider varchar->text change rewrites no
-- data in Postgres.

ALTER TYPE "UtilityServiceType" ADD VALUE IF NOT EXISTS 'BETTING';
ALTER TYPE "UtilityServiceType" ADD VALUE IF NOT EXISTS 'EDUCATION';

-- Education PINs are the only utility sold by the unit.
ALTER TABLE "utility_purchases" ADD COLUMN IF NOT EXISTS "quantity" INTEGER;

-- Whose betting account was funded. Peyflex requires the name on the funding
-- call, and the receipt is worthless without it.
ALTER TABLE "utility_purchases" ADD COLUMN IF NOT EXISTS "beneficiary_name" VARCHAR(120);

-- An education purchase returns every PIN it sold in one `||`-separated
-- string (~47 chars per PIN), so 255 would have truncated at six PINs. A
-- truncated PIN is a customer who paid and got nothing usable.
ALTER TABLE "utility_purchases" ALTER COLUMN "delivered_token" TYPE TEXT;
