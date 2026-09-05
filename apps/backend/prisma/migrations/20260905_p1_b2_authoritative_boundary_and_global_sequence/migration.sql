-- P1-B2 Continuation: Authoritative Write Boundary & Global Sequence Uniqueness
-- Enforces that new audit writes are strictly authoritative and prevents
-- confusion between legacy NULL rows and unauthorized writes.

-- Step 1: Add global sequence uniqueness (across all segments)
-- The architecture specifies GLOBAL monotonic sequence, not per-segment.
-- This partial unique index allows legacy NULL sequences but enforces
-- global uniqueness for all authoritative rows.
CREATE UNIQUE INDEX "audit_logs_sequence_global_key"
  ON "audit_logs"("sequence")
  WHERE "sequence" IS NOT NULL;

-- Step 2: Add authoritative-write boundary trigger.
-- CRITICAL: Enforces that ALL new writes after P1-B2 are authoritative.
-- Rejects any attempt to insert with segment_id=NULL (legacy create() blocked).
-- This boundary prevents unauthorized writes from masquerading as legacy data.
-- The frozen contract: ALL new writes MUST use append(tx, event) with all four
-- authoritative fields NOT NULL. The deprecated create() path is disabled.
CREATE OR REPLACE FUNCTION audit_logs_authoritative_boundary_check()
RETURNS TRIGGER AS $$
BEGIN
  -- P1-B2 enforcement: ALL new writes are authoritative.
  -- No NULL-field rows are permitted after P1-B2 migration.
  -- Legacy rows (if any) must exist in database BEFORE this migration runs.

  IF (NEW."segment_id" IS NULL AND NEW."sequence" IS NULL AND NEW."hash" IS NULL AND NEW."predecessor_hash" IS NULL) THEN
    -- Attempting to create a legacy NULL row (deprecated create() path)
    -- This is blocked post-P1-B2. All new writes must use append(tx, event).
    RAISE EXCEPTION 'Legacy write boundary violated: all NULL authoritative fields rejected after P1-B2. Use append(tx, event) within Class-A transaction.';
  END IF;

  -- All other cases: authoritative fields must satisfy atomicity (all NOT NULL or all NULL enforced by CHECK)
  -- At this point, at least one field is NOT NULL, so all four must be NOT NULL (CHECK constraint).
  -- The trigger has already rejected the all-NULL case above, so we trust CHECK for the rest.

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (idempotent)
DROP TRIGGER IF EXISTS audit_logs_authoritative_boundary_check_trigger ON "audit_logs";

-- Create trigger on INSERT
CREATE TRIGGER audit_logs_authoritative_boundary_check_trigger
BEFORE INSERT ON "audit_logs"
FOR EACH ROW
EXECUTE FUNCTION audit_logs_authoritative_boundary_check();

-- Step 3: Document the authoritative-write boundary in a comment.
-- P1-B2 ENFORCEMENT: All new writes after migration are authoritative.
-- The deprecated create() method is BLOCKED by the trigger above.
-- All operational writes MUST use append(tx, event) within a Class-A transaction.
-- The trigger rejects any attempt to insert with all four authoritative fields NULL.
COMMENT ON TABLE "audit_logs" IS
  'Audit log with P1-B2 authoritative-write boundary enforcement:

   Write paths:
   - BLOCKED: create(input) - deprecated legacy path now rejected by trigger
   - REQUIRED: append(tx, event) - must be used within Class-A Serializable transaction

   Enforcement:
   - Trigger audit_logs_authoritative_boundary_check rejects all-NULL authoritative fields
   - All new rows have segment_id, sequence, hash, predecessor_hash NOT NULL
   - Global sequence uniqueness enforced via unique index (sequence) WHERE sequence IS NOT NULL
   - CHECK constraint ensures atomicity: all four NOT NULL or all four NULL (legacy only, if pre-migrated)

   Boundary: No new NULL rows can be created after P1-B2 migration.
   All writes must be authoritative with cryptographic chain verification.';
