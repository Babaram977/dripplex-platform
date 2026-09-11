-- DPX-CAMPAIGN-001 — a campaign gets a budget and a benefit floor.
--
-- `usage_limit` bounds how many times a campaign is used, which is not the same
-- thing as what it costs: ten thousand redemptions of "20% off" costs whatever
-- ten thousand baskets happen to add up to, and nobody knows that number in
-- advance. A budget is the only control that bounds actual spend.
--
-- Both nullable / zero-defaulted, so every campaign that already exists keeps
-- behaving exactly as it does today: uncapped budget, no floor.
ALTER TABLE "promotions"
  ADD COLUMN "min_discount" DECIMAL(12, 2),
  ADD COLUMN "budget_amount" DECIMAL(14, 2),
  ADD COLUMN "budget_spent" DECIMAL(14, 2) NOT NULL DEFAULT 0;

-- Backfill what running campaigns have already spent, so a budget set on one
-- tomorrow starts from the truth rather than from zero. Without this, adding a
-- ₦500,000 budget to a campaign that has already given away ₦400,000 would
-- authorise ₦900,000.
UPDATE "promotions" AS p
   SET "budget_spent" = COALESCE(spent.total, 0)
  FROM (
    SELECT "promotion_id", SUM("amount_saved") AS total
      FROM "promotion_redemptions"
     GROUP BY "promotion_id"
  ) AS spent
 WHERE spent."promotion_id" = p."id";
