-- Whose referral code this is, and therefore which wallet the reward lands in.
--
-- Founder decision, 2026-08-26: drivers market DrippleX to customers, and a
-- driver whose code is used earns ₦350 of wallet cash — in their DRIVER
-- wallet, which is the balance their app shows and the one they can withdraw.
-- Paid on the referred customer's first completed ride, the same anti-fraud
-- rule the customer scheme already uses.
--
-- Recorded on the row rather than derived from the holder's profiles at payout
-- time: a customer who later signs up to drive must not have their past
-- rewards retroactively redirected to a wallet they never earned them in.
CREATE TYPE "ReferralOwnerType" AS ENUM ('CUSTOMER', 'DRIVER');

-- Every code that exists today was issued through the customer app, which is
-- what the default encodes; no existing row changes meaning.
ALTER TABLE "referrals"
  ADD COLUMN "owner_type" "ReferralOwnerType" NOT NULL DEFAULT 'CUSTOMER';
