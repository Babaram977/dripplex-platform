-- DPX-DRIVER-007 — Driver Registration Completion
-- Founder decision 2026-08-08: the Driver Registration Figma flow collects an
-- emergency-contact Relationship (required in the UI) and an optional Email in
-- addition to name/phone. Persist them as real data rather than dropping them.
-- Both columns are nullable so existing driver_profiles rows are unaffected and
-- no backfill is required (only new/edited submissions populate them).
--
-- Hand-curated to include ONLY the statements this change produces, matching the
-- discipline of the prior migrations in this tree; the shadow diff otherwise
-- surfaces the same pre-existing drift documented in docs/REALITY-STAGE-R1.1.md.

-- AlterTable
ALTER TABLE "driver_profiles" ADD COLUMN     "emergency_contact_relationship" VARCHAR(50),
ADD COLUMN     "emergency_contact_email" VARCHAR(255);
