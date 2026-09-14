-- P1-B2 — Audit segments, segment authority and the global audit sequence.
--
-- The foundation for a verifiable audit stream: every authoritative event gets
-- a globally unique, monotonic sequence number and a hash chained to its
-- predecessor, and the stream is divided into segments that can later be
-- closed, archived and purged as a unit.
--
-- PURELY ADDITIVE. Every existing `audit_logs` row keeps working untouched:
-- the four new columns are nullable and existing rows satisfy the atomicity
-- CHECK through its all-NULL branch.
--
-- Deliberately NOT in this migration: the authoritative-write boundary trigger
-- that rejects inserts with all four columns NULL. 404 call sites in this
-- backend write audit rows through AuditService.record(), which produces
-- exactly that shape. Installing the trigger before those callers move to an
-- append() path would reject every one of them — campaign enrolment, payouts,
-- KYC decisions — on a platform taking live money. The boundary lands with the
-- append path that makes it satisfiable, and not before.

-- ─── Segment lifecycle ───────────────────────────────────────────────────────
CREATE TYPE "AuditSegmentLifecycle" AS ENUM (
  'ACTIVE',
  'CLOSED',
  'ARCHIVE_PENDING',
  'ARCHIVED_VERIFIED',
  'PURGE_AUTHORIZED',
  'PURGED'
);

-- ─── Segments ────────────────────────────────────────────────────────────────
CREATE TABLE "audit_segments" (
  "id"                     UUID NOT NULL,
  "lifecycle"              "AuditSegmentLifecycle" NOT NULL DEFAULT 'ACTIVE',
  "first_sequence"         BIGINT NOT NULL,
  "last_sequence"          BIGINT,
  "first_hash"             CHAR(64) NOT NULL,
  "last_hash"              CHAR(64) NOT NULL,
  "event_count"            INT NOT NULL DEFAULT 0,
  "predecessor_segment_id" UUID,
  "predecessor_tail_hash"  CHAR(64),
  "closed_at"              TIMESTAMP(3),
  "closure_reason"         VARCHAR(500),
  "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_segments_pkey" PRIMARY KEY ("id"),
  -- RESTRICT, not CASCADE: a segment that another segment chains to cannot be
  -- deleted out from under it. Losing the predecessor breaks verification of
  -- everything after it.
  CONSTRAINT "audit_segments_predecessor_segment_id_fkey"
    FOREIGN KEY ("predecessor_segment_id")
    REFERENCES "audit_segments"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Exactly one ACTIVE segment can exist. This is the database enforcing the
-- invariant rather than the application remembering it: two ACTIVE segments
-- means two places to append, and no answer to which one holds the tail.
CREATE UNIQUE INDEX "audit_segments_active_idx"
  ON "audit_segments"("lifecycle")
  WHERE "lifecycle" = 'ACTIVE';

CREATE INDEX "audit_segments_lifecycle_created_at_idx"
  ON "audit_segments"("lifecycle", "created_at" DESC);

CREATE INDEX "audit_segments_predecessor_segment_id_idx"
  ON "audit_segments"("predecessor_segment_id");

-- ─── Stream state ────────────────────────────────────────────────────────────
-- One row, id = 'main'. It is the lock that serialises sequence allocation:
-- an appender takes SELECT ... FOR UPDATE on it before reading the next
-- sequence, so two concurrent appends cannot be handed the same number.
CREATE TABLE "audit_stream_state" (
  "id"                     VARCHAR(50) NOT NULL,
  "next_sequence"          BIGINT NOT NULL DEFAULT 1,
  "tail_hash"              CHAR(64) NOT NULL,
  "active_segment_id"      UUID NOT NULL,
  "last_segment_closed_at" TIMESTAMP(3),
  "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_stream_state_pkey" PRIMARY KEY ("id")
);

-- ─── Genesis ─────────────────────────────────────────────────────────────────
-- A fixed id so the first segment is identifiable in any environment, and a
-- zero hash as the chain's genesis anchor: the first real event's predecessor.
INSERT INTO "audit_segments" ("id", "lifecycle", "first_sequence", "first_hash", "last_hash")
VALUES (
  '00000000-0000-0000-0000-000000000001'::UUID,
  'ACTIVE',
  1,
  '0000000000000000000000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000000000000000000000'
);

INSERT INTO "audit_stream_state" ("id", "next_sequence", "tail_hash", "active_segment_id")
VALUES (
  'main',
  1,
  '0000000000000000000000000000000000000000000000000000000000000000',
  '00000000-0000-0000-0000-000000000001'::UUID
);

ALTER TABLE "audit_stream_state"
  ADD CONSTRAINT "audit_stream_state_active_segment_id_fkey"
  FOREIGN KEY ("active_segment_id")
  REFERENCES "audit_segments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── audit_logs: the authoritative columns ───────────────────────────────────
ALTER TABLE "audit_logs"
  ADD COLUMN "segment_id"       UUID,
  ADD COLUMN "sequence"         BIGINT,
  ADD COLUMN "hash"             CHAR(64),
  ADD COLUMN "predecessor_hash" CHAR(64);

-- All four together or none at all. A row with a sequence but no hash is
-- unverifiable and a row with a hash but no sequence has no place in the
-- chain; either would be discovered at verification time, which is far too
-- late. Existing rows take the all-NULL branch unchanged.
--
-- NOT VALID here, VALIDATE in a later migration. `ADD CONSTRAINT ... CHECK` on
-- its own scans the whole table under ACCESS EXCLUSIVE, stalling every audited
-- write for the length of the scan — and 404 call sites in this backend write
-- audit rows, so that stall reaches enrolment, payouts and KYC. NOT VALID takes
-- the lock only long enough to record the constraint.
--
-- The VALIDATE must be a SEPARATE migration, not the next statement here:
-- Prisma runs a multi-statement migration inside one transaction, and a
-- transaction holds the ACCESS EXCLUSIVE lock taken above until it commits. The
-- scan would then happen under the strong lock anyway, which is the problem
-- this split exists to avoid.
ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_authoritative_atomicity"
  CHECK (
    (segment_id IS NOT NULL AND sequence IS NOT NULL AND hash IS NOT NULL AND predecessor_hash IS NOT NULL)
    OR
    (segment_id IS NULL AND sequence IS NULL AND hash IS NULL AND predecessor_hash IS NULL)
  ) NOT VALID;

-- Same reasoning: adding a foreign key outright scans the table under ACCESS
-- EXCLUSIVE to validate it.
ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_segment_id_fkey"
  FOREIGN KEY ("segment_id")
  REFERENCES "audit_segments"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  NOT VALID;
