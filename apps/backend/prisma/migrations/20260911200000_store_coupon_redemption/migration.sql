-- DPX-LOYALTY-003 — a coupon can be spent at a merchant's counter.
--
-- Founder decision 2026-09-11: DrippleX funds the in-store discount and settles
-- the merchant the same way it settles a points redemption — into their DX
-- wallet.
--
-- The coupon rides on the holder's existing till code rather than being typed
-- in by the merchant. Coupons carry per-user and per-device limits, so
-- redeeming one has to know whose redemption it is; a merchant typing a
-- campaign code they saw on a poster could otherwise spend it against anybody.

ALTER TABLE "loyalty_redemption_codes"
  ADD COLUMN IF NOT EXISTS "coupon_code" VARCHAR(50);
