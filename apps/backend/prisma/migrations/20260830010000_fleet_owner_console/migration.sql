-- DPX-FLEET — fleet owners, their riders and drivers, and what they owe.
--
-- Founder decision, 2026-08-30, after comparing how Talabat works: nearly all
-- of Talabat's ~20,000 riders work for fleet partners rather than the platform
-- itself. DrippleX takes the same shape. The fleet owner supplies the bikes
-- and cars and agrees pay with his riders privately; DrippleX supplies the
-- demand and charges the fleet a percentage of the delivery fees its members
-- earned, and of the fares its drivers took.
--
-- What is NOT delegated is who may ride. KYC, identity verification and
-- onboarding stay with Operations exactly as they are for every other rider
-- and driver: the fleet decides who it employs, DrippleX still decides who may
-- work.

-- The fleet becomes a commercial counterparty alongside merchants, drivers and
-- riders, so it accrues, owes and settles through the CommissionAccount
-- machinery that already exists rather than a parallel one.
ALTER TYPE "CommissionOwnerType" ADD VALUE IF NOT EXISTS 'FLEET';

CREATE TYPE "FleetStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "FleetMemberRole" AS ENUM ('RIDER', 'DRIVER');
CREATE TYPE "FleetMemberStatus" AS ENUM ('ACTIVE', 'DEACTIVATED', 'REMOVED');

CREATE TABLE "fleets" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    -- The Fleet DX number. Human-readable because that is how it is used: an
    -- owner reads it down the phone to Operations, who attach the rider to it.
    "fleet_number" VARCHAR(20) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "contact_phone" VARCHAR(20),
    "status" "FleetStatus" NOT NULL DEFAULT 'ACTIVE',
    -- A rate agreed with this fleet individually, overriding the bands.
    -- Founder decision 2026-08-30, the same principle as merchant credit
    -- limits: a fleet of six cars and a fleet of a hundred bikes cannot share
    -- one table. Null means the band table applies.
    "negotiated_rate" DECIMAL(5,4),
    "negotiated_by" UUID,
    "negotiated_at" TIMESTAMP(3),
    "negotiation_note" VARCHAR(500),
    "suspended_at" TIMESTAMP(3),
    "suspended_reason" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fleets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fleets_owner_id_key" ON "fleets"("owner_id");
CREATE UNIQUE INDEX "fleets_fleet_number_key" ON "fleets"("fleet_number");
CREATE INDEX "fleets_status_idx" ON "fleets"("status");
CREATE INDEX "fleets_deleted_at_idx" ON "fleets"("deleted_at");

CREATE TABLE "fleet_members" (
    "id" UUID NOT NULL,
    "fleet_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "FleetMemberRole" NOT NULL,
    "status" "FleetMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "deactivated_at" TIMESTAMP(3),
    "deactivated_reason" VARCHAR(500),
    "removed_at" TIMESTAMP(3),
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    -- Null once the membership is over, the user id while it is live. The
    -- unique index below then makes the database itself guarantee nobody rides
    -- for two fleets at once, which an application check loses to a race
    -- between two operators attaching the same rider.
    "active_user_id" UUID,

    CONSTRAINT "fleet_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fleet_members_active_user_id_key" ON "fleet_members"("active_user_id");
CREATE INDEX "fleet_members_fleet_id_status_idx" ON "fleet_members"("fleet_id", "status");
CREATE INDEX "fleet_members_user_id_idx" ON "fleet_members"("user_id");

-- The volume bands that decide a fleet's rate.
--
-- A table rather than constants, deliberately. The founder gave 999-4,999 at
-- 8% and 5,000-9,999 at 6.5% as an illustration ("something like that"), and
-- the bands below and above were never set. Operations enters the real figures
-- and edits them per negotiation without a deploy — and no band had to be
-- invented in code to fill the gap.
CREATE TABLE "fleet_commission_tiers" (
    "id" UUID NOT NULL,
    "min_orders" INTEGER NOT NULL,
    "max_orders" INTEGER,
    -- Fraction, not percent: 0.0800 is 8%.
    "rate" DECIMAL(5,4) NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fleet_commission_tiers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fleet_commission_tiers_min_orders_key" ON "fleet_commission_tiers"("min_orders");

-- One calendar month of a fleet's trading.
--
-- Founder decision 2026-08-30: the whole month settles at the band the total
-- reaches — crossing 5,000 orders makes every order that month cheaper, not
-- only the ones after the threshold. That is unknowable until the month
-- closes, so the running figures are an estimate until settled_at, and the
-- rate finally applied is snapshotted the way Ride.platform_commission_rate
-- already is, so editing the tier table never rewrites an invoiced month.
CREATE TABLE "fleet_commission_periods" (
    "id" UUID NOT NULL,
    "fleet_id" UUID NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "order_count" INTEGER NOT NULL DEFAULT 0,
    -- What commission is charged on: the delivery fee for a delivery, the trip
    -- fare for a ride. Never the basket the merchant sold.
    "chargeable_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "applied_rate" DECIMAL(5,4),
    "commission_amount" DECIMAL(14,2),
    "settled_at" TIMESTAMP(3),
    "settled_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fleet_commission_periods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fleet_commission_periods_fleet_id_period_start_key" ON "fleet_commission_periods"("fleet_id", "period_start");
CREATE INDEX "fleet_commission_periods_settled_at_idx" ON "fleet_commission_periods"("settled_at");

ALTER TABLE "fleets" ADD CONSTRAINT "fleets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fleet_members" ADD CONSTRAINT "fleet_members_fleet_id_fkey" FOREIGN KEY ("fleet_id") REFERENCES "fleets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fleet_members" ADD CONSTRAINT "fleet_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fleet_commission_periods" ADD CONSTRAINT "fleet_commission_periods_fleet_id_fkey" FOREIGN KEY ("fleet_id") REFERENCES "fleets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
