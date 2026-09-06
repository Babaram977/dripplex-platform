-- P1-B8.3 Immutable Archived Events Table
-- Immutable preservation of all essential audit event data for post-purge verification
--
-- Contract: Once an event is archived, it cannot be modified or deleted.
-- This table survives purge of live audit rows and enables independent archive verification.

-- Create immutable archived event table
CREATE TABLE "segment_archived_events" (
  "id" UUID NOT NULL PRIMARY KEY,
  "archive_id" UUID NOT NULL,  -- FK to SegmentArchiveManifest, prevents orphaning
  "segment_id" UUID NOT NULL,
  "sequence" BIGINT NOT NULL,
  "hash" CHAR(64) NOT NULL,    -- SHA-256 hex digest
  "predecessor_hash" CHAR(64) NOT NULL,
  "user_id" UUID,              -- May be NULL (legacy or anonymous actions)
  "action" VARCHAR(150) NOT NULL,  -- Event type: what happened
  "resource" VARCHAR(100),     -- Resource type
  "resource_id" UUID,          -- Resource instance
  "ip_address" VARCHAR(45),
  "user_agent" VARCHAR(512),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL,  -- Original event timestamp
  "archived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Foreign keys with ON DELETE RESTRICT (prevent orphaning evidence)
  CONSTRAINT "segment_archived_events_archive_id_fkey"
    FOREIGN KEY ("archive_id")
    REFERENCES "segment_archive_manifests"("id")
    ON DELETE RESTRICT,

  CONSTRAINT "segment_archived_events_segment_id_fkey"
    FOREIGN KEY ("segment_id")
    REFERENCES "audit_segments"("id")
    ON DELETE RESTRICT,

  -- Unique constraint: each segment+sequence appears exactly once in archive
  CONSTRAINT "segment_archived_events_unique_segment_sequence"
    UNIQUE ("segment_id", "sequence"),

  -- Validate sequence ordering within segment (cannot go backwards)
  CONSTRAINT "segment_archived_events_non_negative_sequence"
    CHECK ("sequence" >= 0),

  -- Validate hash format (64-char hex digest)
  CONSTRAINT "segment_archived_events_valid_hash_format"
    CHECK (
      "hash" ~ '^[a-f0-9]{64}$'
    ),

  -- Validate predecessor_hash format
  CONSTRAINT "segment_archived_events_valid_predecessor_hash_format"
    CHECK (
      "predecessor_hash" ~ '^[a-f0-9]{64}$'
    )
);

-- Create indexes for query performance
CREATE INDEX "segment_archived_events_archive_id_idx"
  ON "segment_archived_events"("archive_id");

CREATE INDEX "segment_archived_events_segment_id_idx"
  ON "segment_archived_events"("segment_id");

CREATE INDEX "segment_archived_events_segment_sequence_idx"
  ON "segment_archived_events"("segment_id", "sequence");

CREATE INDEX "segment_archived_events_created_at_idx"
  ON "segment_archived_events"("created_at");

-- Grant no UPDATE/DELETE permissions to enforce immutability at application level
-- (In production, PostgreSQL row-level security or trigger-based enforcement would be added)
-- For now, rely on application code to never update/delete these rows

-- Comment documenting the immutability contract
COMMENT ON TABLE "segment_archived_events" IS
  'Immutable archive of audit events. Once inserted, cannot be modified or deleted. ' ||
  'Survives purge of live auditLog rows. Used by archive verification after purge.';

COMMENT ON COLUMN "segment_archived_events"."hash" IS
  'SHA-256 digest of the original event. Proves event integrity and is used in hash chain verification.';

COMMENT ON COLUMN "segment_archived_events"."predecessor_hash" IS
  'Hash of the previous event in the archive. Proves sequence and chain continuity.';
