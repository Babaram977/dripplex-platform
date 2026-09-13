-- DPX-PROMO-REF-001 — the universal new-customer acquisition incentive.
--
-- Founder ruling 2026-09-12: every customer acquired through an eligible
-- referral gets 20% off their first three completed rides, identically, whoever
-- referred them. The referral source decides only what the promoter earns.
--
-- ONE platform-wide row, not one per campaign. The incentive is universal, and
-- a row per campaign would let campaigns drift apart — and would let a customer
-- meet a second one and start again, which the ruling forbids.
--
-- The three-ride ceiling is `rules.maxPriorCompletedRides`, NOT `per_user_limit`.
-- `per_user_limit` counts redemptions, which are claims: a customer who declined
-- the discount twice would still hold three claims and could stretch the benefit
-- indefinitely. The rule counts completed rides from the rides table, so ride #1
-- sees 0 prior rides and ride #4 sees 3 and stops. Declining a discount cannot
-- bank a slot, and no campaign can reset the count.
--
-- `referral_only` is what limits it to acquired customers. That rule has existed
-- in the evaluator since promotions shipped and was dead in production, because
-- nothing ever populated the eligibility context it reads; the ride path now
-- does.
--
-- Seeded at a fixed id with ON CONFLICT DO NOTHING, the same singleton pattern
-- as loyalty_settings, so a redeploy or a re-run cannot create a second one.
-- Two of these would stack into 40% off.
INSERT INTO "promotions" (
  "id", "name", "type", "status", "domains", "percent_off",
  "rules", "priority", "stackable", "metadata", "updated_at"
)
VALUES (
  '00000000-0000-4000-8000-00000000200a',
  'Referred customer — 20% off first 3 rides',
  'PERCENTAGE',
  'ACTIVE',
  ARRAY['RIDE']::"PromotionDomain"[],
  20,
  '{"referralOnly": true, "maxPriorCompletedRides": 3}'::jsonb,
  0,
  false,
  '{"dpx": "DPX-PROMO-REF-001", "kind": "universal-acquisition-incentive"}'::jsonb,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
