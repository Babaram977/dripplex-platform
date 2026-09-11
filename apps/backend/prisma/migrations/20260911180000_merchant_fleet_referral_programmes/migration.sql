-- DPX-REFERRAL-002 — merchants and fleet owners get referral codes.
--
-- Founder decision 2026-09-11: "creates merchant and fleet owner referral
-- programs". They were the two earning personas with no way to be credited for
-- bringing DrippleX a customer, while a driver or rider doing the identical
-- thing earned the standing reward.
--
-- Nothing else about the scheme changes: the code is redeemed at a new
-- customer's registration and pays on that customer's first completed ride,
-- which is the locked anti-fraud rule, and both sides get the locked amount.

ALTER TYPE "ReferralOwnerType" ADD VALUE IF NOT EXISTS 'MERCHANT';
ALTER TYPE "ReferralOwnerType" ADD VALUE IF NOT EXISTS 'FLEET_OWNER';
