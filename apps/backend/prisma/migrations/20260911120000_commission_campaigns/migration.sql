-- DPX-COMMISSION-001 — commission rates that apply for a window, to a scope,
-- under conditions. The standing singletons (merchant_commission_settings,
-- platform_commission_settings) keep their meaning; a campaign is a temporary
-- override on top of them.
--
-- Written to be safe to re-run: this database has had migrations resolved
-- by hand before, and a half-applied migration that cannot be replayed is
-- how a production deploy gets stuck.

DO $$ BEGIN
  CREATE TYPE "CommissionScope" AS ENUM ('MERCHANT_ORDER', 'DELIVERY', 'RIDE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CommissionCampaignStatus" AS ENUM (
    'DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'EXPIRED', 'ARCHIVED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "commission_campaigns" (
  "id"              UUID NOT NULL,
  "name"            VARCHAR(150) NOT NULL,
  "description"     TEXT,
  "scope"           "CommissionScope" NOT NULL,
  "commission_rate" DECIMAL(5, 4) NOT NULL,
  "status"          "CommissionCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "priority"        INTEGER NOT NULL DEFAULT 0,
  "starts_at"       TIMESTAMP(3) NOT NULL,
  "ends_at"         TIMESTAMP(3) NOT NULL,
  "rules"           JSONB,
  "announce"        BOOLEAN NOT NULL DEFAULT true,
  "announced_at"    TIMESTAMP(3),
  "paused_at"       TIMESTAMP(3),
  "archived_at"     TIMESTAMP(3),
  "created_by"      UUID,
  "updated_by"      UUID,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "commission_campaigns_pkey" PRIMARY KEY ("id")
);

-- The resolver's hot path: campaigns for one scope that are in force right now.
CREATE INDEX IF NOT EXISTS "commission_campaigns_scope_status_starts_at_ends_at_idx"
  ON "commission_campaigns" ("scope", "status", "starts_at", "ends_at");
CREATE INDEX IF NOT EXISTS "commission_campaigns_status_idx"
  ON "commission_campaigns" ("status");

-- Provenance on the three money records that snapshot a commission rate.
-- Nullable, and null keeps its existing meaning: the standing setting applied.
-- Every row that exists today is correctly null.
ALTER TABLE "order_settlements"
  ADD COLUMN IF NOT EXISTS "commission_campaign_id" UUID;
ALTER TABLE "rides"
  ADD COLUMN IF NOT EXISTS "commission_campaign_id" UUID;
ALTER TABLE "delivery_jobs"
  ADD COLUMN IF NOT EXISTS "commission_campaign_id" UUID;

-- Partners are told when the rate they are charged changes. Its own
-- notification type, not PROMOTION: preferences are keyed on (channel, type),
-- and what DrippleX charges is not marketing a partner should be able to mute
-- alongside offers.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COMMISSION_CAMPAIGN_STARTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COMMISSION_CAMPAIGN_ENDED';
