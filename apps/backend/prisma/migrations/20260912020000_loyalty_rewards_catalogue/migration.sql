-- DPX-LOYALTY-004 — the DX Points rewards catalogue.
--
-- Founder decision 2026-09-11: redemption thresholds "be like 10k 25k 50k".
-- They are rows rather than constants so Operations can add 5,000 or 75,000 or
-- 100,000 without a deployment, and so nothing in the code can confuse a points
-- threshold with naira. 10,000 DX Points is ten thousand points, not NGN 10,000.

DO $$ BEGIN
  CREATE TYPE "LoyaltyRewardType" AS ENUM (
    'DISCOUNT_COUPON', 'FREE_DELIVERY', 'PHYSICAL_GIFT', 'WALLET_BENEFIT', 'SERVICE_BENEFIT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LoyaltyRedemptionStatus" AS ENUM (
    'FULFILLED', 'FULFILMENT_PENDING', 'PROCESSING', 'READY_FOR_COLLECTION', 'SHIPPED',
    'DELIVERED', 'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "loyalty_rewards" (
  "id"                     UUID NOT NULL,
  "name"                   VARCHAR(150) NOT NULL,
  "description"            TEXT,
  "type"                   "LoyaltyRewardType" NOT NULL,
  "points_cost"            INTEGER NOT NULL,
  "monetary_value"         DECIMAL(12, 2),
  "discount_percentage"    DECIMAL(5, 2),
  "max_discount"           DECIMAL(12, 2),
  "stock_quantity"         INTEGER,
  "per_user_limit"         INTEGER,
  "total_redemption_limit" INTEGER,
  "redeemed_count"         INTEGER NOT NULL DEFAULT 0,
  "entitlement_days"       INTEGER,
  "starts_at"              TIMESTAMP(3),
  "ends_at"                TIMESTAMP(3),
  "active"                 BOOLEAN NOT NULL DEFAULT true,
  "created_by"             UUID,
  "updated_by"             UUID,
  "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"             TIMESTAMP(3) NOT NULL,
  CONSTRAINT "loyalty_rewards_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "loyalty_rewards_active_points_cost_idx"
  ON "loyalty_rewards" ("active", "points_cost");

CREATE TABLE IF NOT EXISTS "loyalty_reward_redemptions" (
  "id"              UUID NOT NULL,
  "reward_id"       UUID NOT NULL,
  "user_id"         UUID NOT NULL,
  "points_spent"    INTEGER NOT NULL,
  "reward_type"     "LoyaltyRewardType" NOT NULL,
  "monetary_value"  DECIMAL(12, 2),
  "status"          "LoyaltyRedemptionStatus" NOT NULL DEFAULT 'FULFILLED',
  "ledger_entry_id" UUID,
  "promotion_id"    UUID,
  "expires_at"      TIMESTAMP(3),
  "fulfilled_at"    TIMESTAMP(3),
  "fulfilment_note" VARCHAR(500),
  "idempotency_key" VARCHAR(100) NOT NULL,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "loyalty_reward_redemptions_pkey" PRIMARY KEY ("id")
);

-- Two taps on a slow connection are one redemption, not two. The unique index
-- is what makes that true rather than merely likely.
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_reward_redemptions_user_id_idempotency_key_key"
  ON "loyalty_reward_redemptions" ("user_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "loyalty_reward_redemptions_user_id_created_at_idx"
  ON "loyalty_reward_redemptions" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "loyalty_reward_redemptions_status_idx"
  ON "loyalty_reward_redemptions" ("status");
CREATE INDEX IF NOT EXISTS "loyalty_reward_redemptions_reward_id_idx"
  ON "loyalty_reward_redemptions" ("reward_id");

DO $$ BEGIN
  ALTER TABLE "loyalty_reward_redemptions"
    ADD CONSTRAINT "loyalty_reward_redemptions_reward_id_fkey"
    FOREIGN KEY ("reward_id") REFERENCES "loyalty_rewards"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "loyalty_reward_redemptions"
    ADD CONSTRAINT "loyalty_reward_redemptions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- The opening catalogue the founder named. Seeded as data, not code: these are
-- starting rows Operations edits and adds to, not fixed tiers.
INSERT INTO "loyalty_rewards" (
  "id", "name", "description", "type", "points_cost", "monetary_value",
  "entitlement_days", "active", "updated_at"
)
SELECT gen_random_uuid(), v.name, v.description, v.type::"LoyaltyRewardType", v.cost,
       v.value, 90, true, CURRENT_TIMESTAMP
FROM (VALUES
  ('Free delivery', 'One delivery on DrippleX with the fee waived.', 'FREE_DELIVERY', 10000, NULL::numeric),
  ('NGN 500 discount coupon', 'NGN 500 off your next order.', 'DISCOUNT_COUPON', 25000, 500),
  ('NGN 1,500 discount coupon', 'NGN 1,500 off your next order.', 'DISCOUNT_COUPON', 50000, 1500)
) AS v(name, description, type, cost, value)
WHERE NOT EXISTS (SELECT 1 FROM "loyalty_rewards");
