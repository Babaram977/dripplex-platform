-- P1-B2: Audit Segments & Lifecycle Schema
-- Establishes Class-A transaction audit foundation with cryptographic chain verification.
-- Enables monotonic sequence allocation, hash chain integrity, and global audit stream authority.

-- Step 1: Create enum type for segment lifecycle
CREATE TYPE "AuditSegmentLifecycle" AS ENUM(
  'ACTIVE',
  'CLOSED',
  'ARCHIVE_PENDING',
  'ARCHIVED_VERIFIED',
  'PURGE_AUTHORIZED',
  'PURGED'
);

-- Step 2: Create audit_stream_state table (single global row)
CREATE TABLE "audit_stream_state" (
  "id" VARCHAR(50) NOT NULL,
  "next_sequence" BIGINT NOT NULL DEFAULT 0,
  "tail_hash" CHAR(64) NOT NULL,
  "active_segment_id" UUID NOT NULL,
  "last_segment_closed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_stream_state_pkey" PRIMARY KEY ("id")
);

-- Step 3: Create audit_segments table
CREATE TABLE "audit_segments" (
  "id" UUID NOT NULL,
  "lifecycle" "AuditSegmentLifecycle" NOT NULL DEFAULT 'ACTIVE',
  "first_sequence" BIGINT NOT NULL,
  "last_sequence" BIGINT,
  "first_hash" CHAR(64) NOT NULL,
  "last_hash" CHAR(64) NOT NULL,
  "event_count" INT NOT NULL DEFAULT 0,
  "predecessor_segment_id" UUID,
  "predecessor_tail_hash" CHAR(64),
  "closed_at" TIMESTAMP(3),
  "closure_reason" VARCHAR(500),
  "archived_at" TIMESTAMP(3),
  "archive_verified_at" TIMESTAMP(3),
  "archive_checksum" CHAR(64),
  "purge_authorized_at" TIMESTAMP(3),
  "purge_authorized_by" UUID,
  "purged_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_segments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_segments_predecessor_fkey"
    FOREIGN KEY ("predecessor_segment_id")
    REFERENCES "audit_segments"("id") ON DELETE RESTRICT
);

-- Step 4: Create partial unique index (exactly one ACTIVE segment)
CREATE UNIQUE INDEX "audit_segments_active_idx"
  ON "audit_segments"("lifecycle")
  WHERE "lifecycle" = 'ACTIVE';

-- Step 5: Add indexes to audit_segments
CREATE INDEX "audit_segments_lifecycle_created_at_idx"
  ON "audit_segments"("lifecycle", "created_at" DESC);

CREATE INDEX "audit_segments_predecessor_segment_id_idx"
  ON "audit_segments"("predecessor_segment_id");

-- Step 6: Extend audit_logs table (add columns)
ALTER TABLE "audit_logs"
ADD COLUMN "segment_id" UUID,
ADD COLUMN "sequence" BIGINT,
ADD COLUMN "hash" CHAR(64),
ADD COLUMN "predecessor_hash" CHAR(64);

-- Step 7: Create initial ACTIVE segment
INSERT INTO "audit_segments" (
  "id", "lifecycle", "first_sequence", "first_hash", "last_hash"
) VALUES (
  '00000000-0000-0000-0000-000000000001'::UUID,
  'ACTIVE',
  1,
  '0000000000000000000000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000000000000000000000'
);

-- Step 8: Create initial stream state (single row)
INSERT INTO "audit_stream_state" (
  "id", "next_sequence", "tail_hash", "active_segment_id"
) VALUES (
  'main',
  1,
  '0000000000000000000000000000000000000000000000000000000000000000',
  '00000000-0000-0000-0000-000000000001'::UUID
);

-- Step 9: Add foreign key: audit_stream_state.active_segment_id
ALTER TABLE "audit_stream_state"
ADD CONSTRAINT "audit_stream_state_active_segment_id_fkey"
  FOREIGN KEY ("active_segment_id")
  REFERENCES "audit_segments"("id") ON DELETE RESTRICT;

-- Step 10: Add CHECK constraint to enforce authoritative field atomicity.
-- For new rows inserted via append(): ALL four authoritative fields must be NOT NULL.
-- For legacy rows: all four remain NULL (non-authoritative).
-- This prevents partial authoritative state (e.g., sequence without hash).
ALTER TABLE "audit_logs"
ADD CONSTRAINT "audit_logs_authoritative_atomicity"
  CHECK (
    (segment_id IS NOT NULL AND sequence IS NOT NULL AND hash IS NOT NULL AND predecessor_hash IS NOT NULL)
    OR
    (segment_id IS NULL AND sequence IS NULL AND hash IS NULL AND predecessor_hash IS NULL)
  );

-- Step 11: Add PARTIAL unique constraint (only for authoritative rows).
-- This allows multiple NULL combinations (legacy rows) but enforces uniqueness
-- across all authoritative rows in each segment.
ALTER TABLE "audit_logs"
ADD CONSTRAINT "audit_logs_segment_id_sequence_key"
  UNIQUE ("segment_id", "sequence");

CREATE INDEX "audit_logs_segment_id_idx"
  ON "audit_logs"("segment_id");

CREATE INDEX "audit_logs_segment_id_sequence_idx"
  ON "audit_logs"("segment_id", "sequence");

-- Step 12: Add foreign key: audit_logs.segment_id
ALTER TABLE "audit_logs"
ADD CONSTRAINT "audit_logs_segment_id_fkey"
  FOREIGN KEY ("segment_id")
  REFERENCES "audit_segments"("id") ON DELETE RESTRICT;
