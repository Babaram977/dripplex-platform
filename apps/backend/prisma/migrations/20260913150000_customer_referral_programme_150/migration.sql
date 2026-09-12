-- DPX-PROMO-REF-001 — the CUSTOMER referral programme pays the locked rate.
--
-- Founder ruling 2026-09-13:
--
--   Customer  -> Customer   referrer ₦150, referred customer ₦150
--   Driver    -> Customer   referrer ₦200, referred customer ₦150
--   Pioneer   -> Customer   referrer ₦350, referred customer ₦150
--
-- The referrer side of the last two is a per-promoter campaign rate, held on
-- `campaign_promoters` and set by Operations. Only the first line is programme
-- configuration, and the referred customer's ₦150 is the programme's for every
-- line — `refereeRewardAmount` is read from here whoever referred them.
--
-- This row was seeded 350/350 by 20260912040000 and no migration since has
-- corrected it. What production actually holds has not been read, and this
-- migration is written not to assume: see the guard below.
--
-- WHAT THIS DOES NOT TOUCH
--
-- Only CUSTOMER. MERCHANT (350/350) and FLEET (2500/0) carry no founder ruling
-- and are left exactly as they are — a migration that "tidied" them would be
-- repricing two programmes nobody asked about.
--
-- `hold_days` and `active` are not in the SET list at all. The hold is a
-- founder-locked fraud control and the switch is an operational decision; this
-- migration is about two amounts.
--
-- Historical rows are untouched by construction, not by care. A reward's
-- figures are snapshotted onto `referral_redemptions` at qualification and
-- every later step reads the snapshot, so changing configuration here moves
-- what future referrals qualify at and nothing that has already qualified,
-- been approved, or been paid. That property is asserted in
-- campaign-reward.db.spec.ts rather than assumed.

DO $$
DECLARE
  current_referrer NUMERIC(12,2);
  current_referee  NUMERIC(12,2);
BEGIN
  SELECT "referrer_reward_amount", "referee_reward_amount"
    INTO current_referrer, current_referee
    FROM "referral_programmes"
   WHERE "referee_type" = 'CUSTOMER';

  IF NOT FOUND THEN
    -- No CUSTOMER programme at all. Creating one here would invent a
    -- programme rather than correct one, and a referral with no programme
    -- cannot qualify — which is a visible, harmless state. Say so and stop.
    RAISE NOTICE 'No CUSTOMER referral programme row; nothing to reprice';
    RETURN;
  END IF;

  -- Fail closed on anything other than the states we have actually observed.
  --
  -- 350/350 is what this repository's own seed migration wrote. 150/150 is the
  -- ruled target, accepted so a re-run is a no-op rather than an error.
  -- ANY other pair means somebody set these deliberately — an operator, or a
  -- state nobody has told us about — and silently overwriting a rate somebody
  -- chose is how money moves for reasons no one can explain afterwards.
  --
  -- Refusing costs a deploy. Overwriting costs whatever the difference is,
  -- multiplied by every referral that qualifies before anyone notices.
  IF NOT (
    (current_referrer = 350.00 AND current_referee = 350.00) OR
    (current_referrer = 150.00 AND current_referee = 150.00)
  ) THEN
    RAISE EXCEPTION
      'referral_programmes CUSTOMER is %/% — neither the seeded 350/350 nor the ruled 150/150. Refusing to overwrite a rate somebody set deliberately; confirm the intended amounts with the founder before migrating.',
      current_referrer, current_referee;
  END IF;

  UPDATE "referral_programmes"
     SET "referrer_reward_amount" = 150.00,
         "referee_reward_amount"  = 150.00,
         "updated_at"             = CURRENT_TIMESTAMP
   WHERE "referee_type" = 'CUSTOMER';
END $$;
