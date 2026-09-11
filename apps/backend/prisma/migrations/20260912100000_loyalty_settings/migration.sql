-- DPX-LOYALTY-005 — what DX Points convert to, and whether they may.
--
-- Founder decision 2026-09-11: "let it be as shipped but can be controlled."
-- Nothing about today's behaviour changes. 200 points still buy ₦1, cash-out is
-- still on, in-store spending is still on, and there is still no daily cap —
-- every default below is the constant it replaces. What changes is that each of
-- them becomes an Operations setting rather than a deployment.
CREATE TABLE "loyalty_settings" (
  "id" UUID NOT NULL,
  "points_per_naira" INTEGER NOT NULL DEFAULT 200,
  "wallet_redemption_enabled" BOOLEAN NOT NULL DEFAULT true,
  "store_redemption_enabled" BOOLEAN NOT NULL DEFAULT true,
  "min_redemption_points" INTEGER NOT NULL DEFAULT 200,
  "daily_redemption_points_cap" INTEGER,
  "updated_by" UUID,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "loyalty_settings_pkey" PRIMARY KEY ("id")
);

-- Seeded here rather than left to first-touch, so the row an operator edits
-- exists from the moment this deploys and its values are visible in the
-- migration rather than only in code.
INSERT INTO "loyalty_settings" ("id", "updated_at")
VALUES ('00000000-0000-4000-8000-00000000100a', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
