-- Purge the DrippleX demo cast from every environment.
--
-- The demo seed (prisma/seed-demo.cjs, now removed) created four @dripplex.demo
-- accounts — customer, driver, rider, and the "Dx Resto" merchant — plus their
-- profiles, wallet, business, products, vehicle, KYC, availability and payout
-- bank account. DrippleX is onboarding real businesses now, so the demo data is
-- removed here and can no longer be re-seeded.
--
-- Environment-safe and idempotent: it only ever matches the reserved
-- '@dripplex.demo' email domain and the demo "Food" category (slug 'demo-food'),
-- so it deletes nothing on a fresh database or on any re-run.
--
-- Ordering:
--   1. Wallets are polymorphic (owner_id has no FK back to users), so remove the
--      demo cast's wallets explicitly — their ledger entries cascade from the
--      wallet.
--   2. Deleting the four users cascades everything they own (customer/driver/
--      rider/merchant profiles, business -> merchant KYC, merchant profile ->
--      products -> images/inventory, vehicle, driver KYC, availability, payout
--      bank account, and role links) via the existing ON DELETE CASCADE FKs.
--   3. Remove the now-orphaned demo "Food" category.

DELETE FROM "wallet_ledger_entries"
WHERE "wallet_id" IN (
  SELECT "id" FROM "wallets"
  WHERE "owner_id" IN (SELECT "id" FROM "users" WHERE "email" LIKE '%@dripplex.demo')
);

DELETE FROM "wallets"
WHERE "owner_id" IN (SELECT "id" FROM "users" WHERE "email" LIKE '%@dripplex.demo');

DELETE FROM "users" WHERE "email" LIKE '%@dripplex.demo';

DELETE FROM "categories" WHERE "slug" = 'demo-food';
