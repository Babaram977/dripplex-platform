-- Converge fleet_settlement_requests onto one shape.
--
-- Two migrations create this table with CREATE TABLE IF NOT EXISTS and
-- different definitions, so whichever runs first wins and the other silently
-- no-ops. Production ran 20260910050000 first (20260910043000 was authored
-- later with a backdated timestamp and only applied afterwards), while any
-- database built from scratch replays them in name order and gets 043000's
-- definition. The two disagree:
--
--                     production (050000 first)   fresh replay (043000 first)
--   amount            numeric(18,2)               numeric(14,2)
--   currency          text                        varchar(3)
--   rejection_reason  text                        varchar(500)
--   status            FleetSettlementRequestStatus  varchar(16) + CHECK
--   receivable_id     nullable                    NOT NULL
--   fleet_id FK       ON DELETE CASCADE           ON DELETE RESTRICT
--
-- Two of those are not cosmetic:
--
--   * receivable_id nullable means a settlement request can exist that is not
--     tied to an approved receivable. Requiring an Ops-approved receivable
--     before a fleet can be paid is the financial control this table exists to
--     enforce, and in production the column does not enforce it.
--   * ON DELETE CASCADE means deleting a fleet also deletes its settlement
--     requests — the record of money that was paid out. That history should
--     outlive the fleet row, and RESTRICT is what the newer migration intended.
--
-- Both are resolved toward the stricter definition. Everything else converges
-- toward the wider type so no existing value can fail to fit.
--
-- Every step is guarded on the current state, so this is safe on a database in
-- either shape and safe to run again.

-- amount: widen 14,2 -> 18,2. Never narrows.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fleet_settlement_requests'
      AND column_name = 'amount'
      AND numeric_precision IS DISTINCT FROM 18
  ) THEN
    ALTER TABLE "fleet_settlement_requests" ALTER COLUMN "amount" TYPE DECIMAL(18,2);
  END IF;
END $$;

-- currency / rejection_reason: varchar -> text. A no-op where already text.
ALTER TABLE "fleet_settlement_requests" ALTER COLUMN "currency" TYPE TEXT;
ALTER TABLE "fleet_settlement_requests" ALTER COLUMN "rejection_reason" TYPE TEXT;

-- status: converge on the enum. The CHECK constraint that guarded the varchar
-- form becomes redundant once the type itself constrains the value, and it has
-- to go first or the type change trips over it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'fleet_settlement_requests'::regclass
      AND attname = 'status'
      AND NOT attisdropped
      AND atttypid <> '"FleetSettlementRequestStatus"'::regtype
  ) THEN
    ALTER TABLE "fleet_settlement_requests"
      DROP CONSTRAINT IF EXISTS "fleet_settlement_requests_status_check";
    ALTER TABLE "fleet_settlement_requests" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "fleet_settlement_requests"
      ALTER COLUMN "status" TYPE "FleetSettlementRequestStatus"
      USING "status"::text::"FleetSettlementRequestStatus";
    ALTER TABLE "fleet_settlement_requests" ALTER COLUMN "status" SET DEFAULT 'PENDING';
  END IF;
END $$;

-- receivable_id: enforce the link to an approved receivable.
--
-- If any row is already unbacked this stops the deploy rather than quietly
-- dropping the rows or leaving the column loose. That is deliberate: a
-- settlement request with no receivable is a payout with no authorisation
-- behind it, and a person should look at it before anything else happens.
DO $$
DECLARE
  unbacked BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fleet_settlement_requests'
      AND column_name = 'receivable_id'
      AND is_nullable = 'YES'
  ) THEN
    SELECT count(*) INTO unbacked
    FROM "fleet_settlement_requests" WHERE "receivable_id" IS NULL;

    IF unbacked > 0 THEN
      RAISE EXCEPTION
        'Refusing to enforce receivable_id NOT NULL: % fleet settlement request(s) have no approved receivable. Reconcile them by hand before deploying.',
        unbacked;
    END IF;

    ALTER TABLE "fleet_settlement_requests" ALTER COLUMN "receivable_id" SET NOT NULL;
  END IF;
END $$;

-- fleet_id: RESTRICT, so settlement history cannot be deleted along with the
-- fleet it belonged to.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fleet_settlement_requests_fleet_id_fkey'
      AND conrelid = 'fleet_settlement_requests'::regclass
      AND confdeltype <> 'r'
  ) THEN
    ALTER TABLE "fleet_settlement_requests"
      DROP CONSTRAINT "fleet_settlement_requests_fleet_id_fkey";
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fleet_settlement_requests_fleet_id_fkey'
      AND conrelid = 'fleet_settlement_requests'::regclass
  ) THEN
    ALTER TABLE "fleet_settlement_requests"
      ADD CONSTRAINT "fleet_settlement_requests_fleet_id_fkey"
      FOREIGN KEY ("fleet_id") REFERENCES "fleets"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
