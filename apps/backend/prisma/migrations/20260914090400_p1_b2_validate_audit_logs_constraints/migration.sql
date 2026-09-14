-- Validate the two constraints added NOT VALID by
-- 20260914090000_p1_b2_audit_segments_and_global_sequence.
--
-- VALIDATE CONSTRAINT scans the table under SHARE UPDATE EXCLUSIVE, which
-- blocks neither reads nor writes — unlike the ACCESS EXCLUSIVE that adding the
-- constraint outright would have taken. The two share a transaction safely
-- because neither blocks writes.
--
-- After this runs the end state is identical to adding them the simple way: two
-- fully valid, enforced constraints. The difference is only in what was locked
-- on the way there.
ALTER TABLE "audit_logs" VALIDATE CONSTRAINT "audit_logs_authoritative_atomicity";

ALTER TABLE "audit_logs" VALIDATE CONSTRAINT "audit_logs_segment_id_fkey";
