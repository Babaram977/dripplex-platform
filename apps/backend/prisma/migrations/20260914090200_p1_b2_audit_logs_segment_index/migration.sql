-- One statement, alone in its own migration, and that is the whole point.
--
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction block, and Prisma
-- wraps any multi-statement migration in one. A plain CREATE INDEX would hold a
-- SHARE lock on audit_logs for the entire build, blocking every audited write
-- until it finished.
--
-- Partial, so the index holds only authoritative rows rather than a full-size
-- copy of the table's existing NULLs.
CREATE INDEX CONCURRENTLY "audit_logs_segment_id_idx"
  ON "audit_logs"("segment_id")
  WHERE "segment_id" IS NOT NULL;
