-- DPX-COMMISSION-001 — commission campaigns reach fleets, pro-rata.
--
-- A fleet's rate is banded on its monthly order volume, so it is only knowable
-- when the month closes and a campaign covering part of that month cannot
-- simply replace it. Founder decision 2026-09-11: a mid-month campaign "should
-- add up to previously earned" — the month keeps accumulating across it, the
-- band is still decided on the full month's volume, and the campaign applies
-- only to the days it covers.
--
-- That needs the month's revenue bucketed as it accrues: the period row carries
-- running totals and no per-job dates, so by settlement time there is no way to
-- ask which jobs fell inside a campaign window.

ALTER TYPE "CommissionScope" ADD VALUE IF NOT EXISTS 'FLEET';

CREATE TABLE IF NOT EXISTS "fleet_commission_period_segments" (
  "id"                     UUID NOT NULL,
  "period_id"              UUID NOT NULL,
  "commission_campaign_id" UUID,
  -- The standing band is written as the literal 'STANDING'. Postgres treats
  -- NULLs as distinct in a unique index, so keying on the nullable campaign id
  -- alone would let two standing buckets exist for one month and quietly halve
  -- what the fleet is charged.
  "commission_campaign_key" VARCHAR(64) NOT NULL,
  "campaign_rate"          DECIMAL(5, 4),
  "order_count"            INTEGER NOT NULL DEFAULT 0,
  "chargeable_total"       DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"             TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fleet_commission_period_segments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fleet_commission_period_segments_period_id_commission_campa_key"
  ON "fleet_commission_period_segments" ("period_id", "commission_campaign_key");
CREATE INDEX IF NOT EXISTS "fleet_commission_period_segments_period_id_idx"
  ON "fleet_commission_period_segments" ("period_id");

DO $$ BEGIN
  ALTER TABLE "fleet_commission_period_segments"
    ADD CONSTRAINT "fleet_commission_period_segments_period_id_fkey"
    FOREIGN KEY ("period_id") REFERENCES "fleet_commission_periods"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Deliberately no backfill. Months already trading have no segments, and
-- settlement charges any unsegmented remainder at the band rate — which is
-- exactly what those months should be charged, and is also the guard that
-- keeps a fleet correctly billed if a segment write is ever lost.
