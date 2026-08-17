-- DPX-COMMERCIAL — merchant cash threshold raised to ₦50,000.
--
-- Founder decision (2026-08-17). DEFAULT_MERCHANT_CREDIT_LIMIT is a seed-only
-- fallback, read once when no row exists, so changing the constant alone would
-- leave every existing environment on the ₦10,000 row already seeded from the
-- old default — the new policy would silently not apply in production.
--
-- Deliberately a one-shot migration rather than a repeating upsert: it moves
-- environments off the value nobody chose, and never again fights an operator
-- who later sets a different limit from the Admin Portal.
UPDATE "commercial_credit_settings"
SET "credit_limit" = 50000.00
WHERE "owner_type" = 'MERCHANT'
  AND "credit_limit" = 10000.00
  AND "updated_by" IS NULL;

-- Environments that have not seeded the row yet pick up the new constant on
-- first read, so nothing is inserted here.
