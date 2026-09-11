-- DPX-LOYALTY-008 — a redeemed coupon becomes a coupon somebody can spend.
--
-- `promotion_id` has been on loyalty_reward_redemptions since the catalogue
-- shipped and nothing ever wrote it, so a customer who spent 25,000 DX Points
-- on a "₦500 coupon" received a row and no way to use it. Minting needs to know
-- where the coupon is good, and a reward had no way to say.
ALTER TABLE "loyalty_rewards"
  ADD COLUMN "domains" "PromotionDomain"[] DEFAULT ARRAY[]::"PromotionDomain"[];

-- The two coupons the catalogue opened with become spendable where DrippleX
-- actually evaluates promotions for shopping: a marketplace order, and a
-- merchant's counter.
--
-- RIDE is deliberately left out. The engine supports it, but letting a coupon
-- earned in the rewards catalogue pay for a ride is a scope decision nobody has
-- made, and it is one row to change once somebody does.
UPDATE "loyalty_rewards"
   SET "domains" = ARRAY['MARKETPLACE', 'MERCHANT']::"PromotionDomain"[]
 WHERE "type" = 'DISCOUNT_COUPON';

-- The minted coupon is reachable from the redemption it belongs to, so the
-- holder can be shown the code. A loose id nothing can join to cannot give them
-- one. SET NULL rather than CASCADE: archiving a promotion must not delete the
-- record that somebody spent 25,000 points on it.
ALTER TABLE "loyalty_reward_redemptions"
  ADD CONSTRAINT "loyalty_reward_redemptions_promotion_id_fkey"
  FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
