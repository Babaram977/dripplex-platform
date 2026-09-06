-- P1-B8: Archive, Purge, and Legal Hold Foundation Models
-- Establishes database foundation for segment lifecycle governance.

-- Step 1: Create segment_legal_holds table (segment-level governance holds)
CREATE TABLE "segment_legal_holds" (
  "id" UUID NOT NULL,
  "segment_id" UUID NOT NULL,
  "hold_id" VARCHAR(100) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "placed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "placed_by" UUID NOT NULL,
  "released_at" TIMESTAMP(3),
  "released_by" UUID,
  "release_reason" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "segment_legal_holds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "segment_legal_holds_segment_id_fkey"
    FOREIGN KEY ("segment_id")
    REFERENCES "audit_segments"("id") ON DELETE RESTRICT
);

-- Step 2: Create partial unique index (only one active hold per holdId per segment)
CREATE UNIQUE INDEX "segment_legal_hold_active_idx"
  ON "segment_legal_holds"("segment_id", "hold_id")
  WHERE "released_at" IS NULL;

-- Step 3: Create supporting indexes for legal holds
CREATE INDEX "segment_legal_holds_segment_id_released_at_idx"
  ON "segment_legal_holds"("segment_id", "released_at");

CREATE INDEX "segment_legal_holds_hold_id_released_at_idx"
  ON "segment_legal_holds"("hold_id", "released_at");

-- Step 4: Create segment_legal_hold_releases table (audit trail of releases)
CREATE TABLE "segment_legal_hold_releases" (
  "id" UUID NOT NULL,
  "segment_id" UUID NOT NULL,
  "hold_id" VARCHAR(100) NOT NULL,
  "released_by" UUID NOT NULL,
  "release_reason" VARCHAR(500) NOT NULL,
  "released_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "segment_legal_hold_releases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "segment_legal_hold_releases_segment_id_fkey"
    FOREIGN KEY ("segment_id")
    REFERENCES "audit_segments"("id") ON DELETE RESTRICT
);

-- Step 5: Create supporting indexes for hold releases
CREATE INDEX "segment_legal_hold_releases_segment_id_released_at_idx"
  ON "segment_legal_hold_releases"("segment_id", "released_at");

CREATE INDEX "segment_legal_hold_releases_hold_id_idx"
  ON "segment_legal_hold_releases"("hold_id");

-- Step 6: Create segment_control_events table (separate control stream for governance)
CREATE TABLE "segment_control_events" (
  "id" UUID NOT NULL,
  "sequence" BIGINT NOT NULL,
  "event_type" VARCHAR(100) NOT NULL,
  "segment_id" UUID NOT NULL,
  "predecessor_hash" CHAR(64) NOT NULL,
  "hash" CHAR(64) NOT NULL,
  "manifest_digest" CHAR(64),
  "metadata" JSON NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "segment_control_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "segment_control_event_sequence_key" UNIQUE ("sequence"),
  CONSTRAINT "segment_control_events_segment_id_fkey"
    FOREIGN KEY ("segment_id")
    REFERENCES "audit_segments"("id") ON DELETE RESTRICT
);

-- Step 7: Create supporting indexes for control events
CREATE INDEX "segment_control_events_event_type_created_at_idx"
  ON "segment_control_events"("event_type", "created_at" DESC);

CREATE INDEX "segment_control_events_segment_id_event_type_idx"
  ON "segment_control_events"("segment_id", "event_type");

-- Step 8: Create segment_archive_manifests table (immutable archive summary)
CREATE TABLE "segment_archive_manifests" (
  "id" UUID NOT NULL,
  "segment_id" UUID NOT NULL UNIQUE,
  "first_sequence" BIGINT NOT NULL,
  "last_sequence" BIGINT NOT NULL,
  "event_count" INT NOT NULL,
  "first_hash" CHAR(64) NOT NULL,
  "last_hash" CHAR(64) NOT NULL,
  "predecessor_hash" CHAR(64) NOT NULL,
  "manifest_digest" CHAR(64) NOT NULL,
  "signing_metadata" JSON,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "segment_archive_manifests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "segment_archive_manifests_segment_id_fkey"
    FOREIGN KEY ("segment_id")
    REFERENCES "audit_segments"("id") ON DELETE RESTRICT
);

-- Step 9: Create supporting index for archive manifests
CREATE INDEX "segment_archive_manifests_segment_id_idx"
  ON "segment_archive_manifests"("segment_id");

-- Step 10: Create segment_retention_policies table (policy-based retention rules)
CREATE TABLE "segment_retention_policies" (
  "id" UUID NOT NULL,
  "policy_name" VARCHAR(100) NOT NULL UNIQUE,
  "policy_code" VARCHAR(50) NOT NULL UNIQUE,
  "archive_after_days" INT NOT NULL,
  "purge_after_days" INT NOT NULL,
  "description" VARCHAR(500),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "segment_retention_policies_pkey" PRIMARY KEY ("id")
);

-- Step 11: Create supporting indexes for retention policies
CREATE INDEX "segment_retention_policies_policy_name_idx"
  ON "segment_retention_policies"("policy_name");

CREATE INDEX "segment_retention_policies_is_active_idx"
  ON "segment_retention_policies"("is_active");
