-- DPX-PROMO-REF-001 — founder ruling 2026-09-12: 100 DX Points = ₦1.
--
-- Supersedes the 200 that DPX-LOYALTY-005 shipped in
-- 20260912100000_loyalty_settings. The founder's stated economics are
-- ₦150 = 15,000 points, ₦200 = 20,000 points and ₦350 = 35,000 points, which
-- only holds at 100:1; the 200 was not the intended figure.
--
-- WHAT THIS DOES TO REAL MONEY, stated here because a migration that reprices a
-- live balance should say so where it happens:
--
--   * No points are created or destroyed. Every `loyalty_accounts.points_balance`
--     is untouched.
--   * A point goes from ₦0.005 to ₦0.01, so the naira value of every outstanding
--     balance doubles, and so does the platform's liability against unspent
--     points. That is the accepted, explicitly approved consequence of the
--     ruling.
--   * Settled redemptions are NOT rewritten. Wallet cash-outs snapshot
--     `{points, pointsPerNaira}` into their wallet-transaction metadata, and
--     store redemptions derive their historical rate from the stored
--     points/amount pair. Both read the snapshot, never this row.
--   * `loyalty_rewards.points_cost` is unchanged, so every catalogue reward now
--     costs half as much in real terms. Acknowledged by the founder as a
--     consequence of the ruling rather than a blocker.
--
-- `min_redemption_points` moves with the rate. It means "one naira's worth",
-- and it is only ever validated as a whole multiple of `points_per_naira` —
-- 200 is a whole multiple of 100, so leaving it would have passed every check
-- while silently doubling the smallest allowed cash-out from ₦1 to ₦2.

ALTER TABLE "loyalty_settings" ALTER COLUMN "points_per_naira" SET DEFAULT 100;
ALTER TABLE "loyalty_settings" ALTER COLUMN "min_redemption_points" SET DEFAULT 100;

-- The singleton row already exists — 20260912100000 inserted it — and changing
-- a column default does nothing to a row that is already there. So the live row
-- is updated explicitly.
--
-- Guarded rather than unconditional. The update below only touches the value
-- this ruling supersedes; if Operations has deliberately set some third figure,
-- this migration refuses rather than silently overwriting a decision somebody
-- made on purpose. Refusing is the safe failure here: a wrong rate is money.
DO $$
DECLARE
  current_rate INTEGER;
  current_min  INTEGER;
BEGIN
  SELECT "points_per_naira", "min_redemption_points"
    INTO current_rate, current_min
    FROM "loyalty_settings"
   WHERE "id" = '00000000-0000-4000-8000-00000000100a';

  IF NOT FOUND THEN
    -- Nothing seeded yet; the new defaults above will apply on first insert.
    RAISE NOTICE 'loyalty_settings singleton absent; new defaults (100) will seed it';
    RETURN;
  END IF;

  IF current_rate NOT IN (100, 200) THEN
    RAISE EXCEPTION
      'loyalty_settings.points_per_naira is % — neither the superseded 200 nor the ruled 100. Refusing to overwrite an operator-set rate; resolve this with the founder before migrating.',
      current_rate;
  END IF;

  IF current_min NOT IN (100, 200) THEN
    RAISE EXCEPTION
      'loyalty_settings.min_redemption_points is % — neither the superseded 200 nor the ruled 100. Refusing to overwrite an operator-set minimum.',
      current_min;
  END IF;

  UPDATE "loyalty_settings"
     SET "points_per_naira"      = 100,
         "min_redemption_points" = 100,
         "updated_at"            = CURRENT_TIMESTAMP
   WHERE "id" = '00000000-0000-4000-8000-00000000100a';
END
$$;
