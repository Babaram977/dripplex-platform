-- Riders can hold a referral code of their own.
--
-- Customers and drivers already could. A rider marketing DrippleX had no way
-- to be credited for it, and Referral.ownerType is what decides which wallet a
-- reward is paid into, so this label has to exist before a rider can be issued
-- a code at all.
ALTER TYPE "ReferralOwnerType" ADD VALUE IF NOT EXISTS 'RIDER';
