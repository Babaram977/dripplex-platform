-- DPX-TIER-001 — founder's trip thresholds, 2026-09-11.
--
-- Saeed: "Driver rating goes with number of trips — standard is 500, Silver
-- 1500, Gold 2500, Platinum 4500 trips."
--
-- This raises every bar well above Nora's proposed 100/300/600, and it changes
-- the meaning of STANDARD: it is no longer the tier a driver starts on but one
-- they earn at 500 completed trips. A driver below that holds no tier and is
-- charged the standing platform rate, which is what they were charged before
-- tiers existed — so nobody's commission moves because of this.
--
-- The rating bars are left in place. Saeed's note that reviews "cannot affect
-- the star rating" is about protecting the rating's integrity, not about
-- removing it as a qualification, and a tier earned on volume alone is exactly
-- what Nora's design set out to prevent. Any of these numbers, the rating bars
-- included, can be changed by Operations without a deployment — setting a
-- rating bar to 0 turns it off.

UPDATE "driver_tier_settings" SET "min_completed_trips" = 500,  "updated_at" = CURRENT_TIMESTAMP WHERE "tier" = 'STANDARD';
UPDATE "driver_tier_settings" SET "min_completed_trips" = 1500, "updated_at" = CURRENT_TIMESTAMP WHERE "tier" = 'SILVER';
UPDATE "driver_tier_settings" SET "min_completed_trips" = 2500, "updated_at" = CURRENT_TIMESTAMP WHERE "tier" = 'GOLD';
UPDATE "driver_tier_settings" SET "min_completed_trips" = 4500, "updated_at" = CURRENT_TIMESTAMP WHERE "tier" = 'PLATINUM';
