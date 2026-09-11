-- DPX-TIER-002 — a driver tier becomes a reduction off the commission rate in
-- force, rather than a rate of its own.
--
-- Founder decision 2026-09-11, Option B of docs/DPX-TIER-001 §4.
--
-- The column is renamed rather than added beside the old one, because a
-- `commission_rate` on this table would be a lie the moment the platform rate
-- moved. Nothing historical is lost: every ride snapshots the rate it actually
-- settled at, and its tier, onto the ride row itself.
ALTER TABLE "driver_tier_settings"
  RENAME COLUMN "commission_rate" TO "commission_reduction";

-- The values change meaning, so they are rewritten in the same migration. At
-- today's 10% platform rate these reproduce the specified 10 / 9.5 / 9 / 8.5
-- exactly — and unlike the absolute table, they keep doing something sensible
-- if that 10% ever moves.
UPDATE "driver_tier_settings"
   SET "commission_reduction" = CASE "tier"
     WHEN 'STANDARD' THEN 0.0000
     WHEN 'SILVER'   THEN 0.0050
     WHEN 'GOLD'     THEN 0.0100
     WHEN 'PLATINUM' THEN 0.0150
     ELSE 0.0000
   END;
