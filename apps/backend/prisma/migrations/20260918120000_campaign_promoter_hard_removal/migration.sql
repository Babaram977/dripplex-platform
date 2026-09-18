-- Remove the REMOVED promoters. Founder ruling, 2026-09-18.
--
--   "No soft removal in any campaign, removal should be completely, ops have
--    total control. If it has been trigger by ops there is a reason for that."
--
-- This reverses the earlier soft-removal decision and clears what that decision
-- left behind: promoters sitting in campaign lists as REMOVED with `0/0` and
-- `₦0`, under copy explaining they were kept because their attributions and
-- earnings stand — when for those rows there were none to stand.
--
-- Every row here was already removed by an operator. This migration does not
-- decide that anybody comes off a campaign; it completes removals that have
-- already happened under the old rule.
--
-- WHAT IS DELETED: the participation — token, rate, class.
--
-- WHAT IS NOT: `referral_redemptions` is the only table pointing at a promoter,
-- and those rows record money that moved into people's wallets, with matching
-- entries in the wallet ledger. Deleting them would leave paid money with
-- nothing saying why. `campaign_promoter_id` is nullable by design, so they are
-- DETACHED instead: who referred whom, what was paid and when all survive on
-- the redemption and on the referral that names the referrer. What is lost is
-- the campaign -> participation -> token link on those historical rows. That is
-- the price of the ruling, stated rather than discovered later.
--
-- Detaching first is also what makes the delete possible: the foreign key is
-- ON DELETE RESTRICT, so deleting a promoter that still carried attributions
-- would fail. One transaction, which a Prisma migration already is.
--
-- ACTIVE promoters are untouched by the WHERE clause, not by care.

UPDATE "referral_redemptions"
   SET "campaign_promoter_id" = NULL
 WHERE "campaign_promoter_id" IN (
   SELECT "id" FROM "campaign_promoters" WHERE "status" = 'REMOVED'
 );

DELETE FROM "campaign_promoters" WHERE "status" = 'REMOVED';

-- The REMOVED enum value is deliberately left in place.
--
-- PostgreSQL cannot drop a value from an enum type; removing it means creating
-- a replacement type, rewriting the column and swapping them, on a live table,
-- for a value that after this migration no rows carry and no code writes. The
-- cost of that surgery is real and the benefit is cosmetic. That nothing writes
-- it again is held by a test rather than by the type system, which is stated
-- here so the next person does not read the surviving value as a live state.
