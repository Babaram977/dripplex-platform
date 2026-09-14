-- One statement, alone in its own migration, and that is the whole point.
--
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction block, and Prisma
-- wraps any multi-statement migration in one. A plain CREATE INDEX would hold a
-- SHARE lock on audit_logs for the entire build, blocking every audited write
-- until it finished.
--
-- Partial, so the index holds only authoritative rows rather than a full-size
-- copy of the table's existing NULLs.
--
-- The sequence is GLOBAL, not per-segment: a number unique only within a
-- segment cannot answer "what happened next" across the platform. There is
-- deliberately no separate UNIQUE (segment_id, sequence) — global uniqueness
-- already implies it.
CREATE UNIQUE INDEX CONCURRENTLY "audit_logs_sequence_global_key"
  ON "audit_logs"("sequence")
  WHERE "sequence" IS NOT NULL;
