-- Close the schema/migration drift first flagged on 2026-08-07
-- (docs/REALITY-STAGE-R1.1.md, and the note at the top of
-- 20260807120000_dpx_profile_kyc_001_editable_profile_and_customer_kyc).
--
-- Every statement here is idempotent. Production could not be inspected from the
-- session that wrote this — Railway is connected as an OAuth app, which returns
-- variable names with values redacted, so there is no database URL to read. The
-- migration history is the best available model of production and this was
-- verified against a database built from it, but "best available model" is not
-- "verified against production", and a migration that assumes an exact state it
-- could not check is how a deploy fails at 2am. Re-running any statement below
-- is a no-op.
--
-- Four other drift items were fixed in schema.prisma instead of here, because
-- the DATABASE was right and the schema under-described it. They are listed in
-- the PR; the important one is `promotions_domains_idx`, which the migration
-- history correctly builds as GIN over an array column and which a naive
-- `prisma migrate diff` proposed replacing with a btree index that could not
-- serve the containment queries it exists for.

-- ── Redundant column defaults ───────────────────────────────────────────────
--
-- The database carries `DEFAULT gen_random_uuid()` on these four id columns;
-- schema.prisma declares `@default(uuid())`, which Prisma generates client-side
-- and does not back with a database default. Prisma Client therefore always
-- supplies the id, and no raw INSERT in the migration history omits it (the one
-- that inserts into inspection_centres names the column explicitly), so the
-- default is unreachable rather than load-bearing.
ALTER TABLE "driver_identity_verifications" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "inspection_centres" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "inspections" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "vehicles" ALTER COLUMN "id" DROP DEFAULT;

-- ── Hotel foreign keys: add the missing ON UPDATE CASCADE ───────────────────
--
-- These five are the only foreign keys in the database without it: 132 of 137
-- carry ON UPDATE CASCADE, and these are the outliers, so the schema is right
-- and the migration that created them was the odd one out.
--
-- In practice this changes no behaviour — every referenced key is an immutable
-- UUID primary key, so ON UPDATE never fires. It is fixed anyway because a
-- permanently-dirty diff is what let the genuinely important items in this
-- migration sit unnoticed since August.
ALTER TABLE "room_types" DROP CONSTRAINT IF EXISTS "room_types_business_id_fkey";
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "room_availability" DROP CONSTRAINT IF EXISTS "room_availability_room_type_id_fkey";
ALTER TABLE "room_availability" ADD CONSTRAINT "room_availability_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_customer_id_fkey";
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_business_id_fkey";
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_room_type_id_fkey";
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── wallet_ledger_entries: partial unique index → full ──────────────────────
--
-- The index exists, under exactly the expected name, but it is PARTIAL:
--
--   CREATE UNIQUE INDEX ... (wallet_id, reference_type, reference_id)
--     WHERE (reference_id IS NOT NULL)
--
-- Prisma's schema language cannot express a partial index, so `@@unique` renders
-- as a full one and the diff has reported it missing ever since. It was never
-- missing — this is the one item where the earlier reports of "a missing unique
-- constraint on wallet_ledger_entries" were wrong. The idempotency guard on a
-- money table was there all along.
--
-- The two are equivalent for this table. PostgreSQL treats NULLs as distinct in
-- a unique index, so a full index still permits unlimited rows with a NULL
-- reference_id (verified empirically, not assumed) while rejecting duplicate
-- non-NULL references exactly as the partial one does.
--
-- Converting cannot fail on existing data: the partial index already guarantees
-- there is no duplicate among the rows the full index would newly constrain.
-- The names collide, so the drop must precede the create; both run inside the
-- migration's transaction, so no other session sees a window without the
-- constraint.
DROP INDEX IF EXISTS "wallet_ledger_entries_wallet_id_reference_type_reference_id_key";
CREATE UNIQUE INDEX IF NOT EXISTS "wallet_ledger_entries_wallet_id_reference_type_reference_id_key" ON "wallet_ledger_entries"("wallet_id", "reference_type", "reference_id");

-- ── Two index names truncated differently ──────────────────────────────────
--
-- Cosmetic, and the reason the whole diff stayed noisy. Guarded on both sides:
-- renamed only when the old name is present and the new one is not, so this is
-- a no-op on a database that already carries either outcome.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'analytics_daily_metrics_metric_date_scope_type_scope_id_metric_')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'analytics_daily_metrics_metric_date_scope_type_scope_id_met_key') THEN
    ALTER INDEX "analytics_daily_metrics_metric_date_scope_type_scope_id_metric_"
      RENAME TO "analytics_daily_metrics_metric_date_scope_type_scope_id_met_key";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'notification_delivery_attempts_notification_id_attempt_number_k')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'notification_delivery_attempts_notification_id_attempt_numb_key') THEN
    ALTER INDEX "notification_delivery_attempts_notification_id_attempt_number_k"
      RENAME TO "notification_delivery_attempts_notification_id_attempt_numb_key";
  END IF;
END $$;
