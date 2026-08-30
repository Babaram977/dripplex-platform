-- DPX-FLEET — fleet owners register themselves, riders quote the DX number.
--
-- Founder decision, 2026-08-30: "The two clients needing fleet registration
-- will go online and register themselves then the system should issue a dx
-- fleet number for them which their riders and drivers will use at onboarding
-- process."
--
-- Two new waiting states fall out of that, and both exist to stop money moving
-- on an unchecked claim:
--
--   Fleet.PENDING_APPROVAL — the owner is issued their DX number the moment
--   they register, because they need it to give to their riders, but the fleet
--   is not a billable partner until Operations has checked it. DrippleX still
--   decides who may work.
--
--   FleetMember.PENDING — a rider typed this fleet's number themselves, so the
--   owner confirms it before they are a member. Otherwise anyone could type
--   any company's number and that company would be invoiced for their jobs.
--
-- Existing rows are untouched: both defaults stay as they were, so every fleet
-- Operations already created remains ACTIVE and every member remains a member.

ALTER TYPE "FleetStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';
ALTER TYPE "FleetStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

ALTER TYPE "FleetMemberStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "FleetMemberStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

ALTER TABLE "fleets"
  ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approved_by" UUID,
  ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejected_reason" VARCHAR(500);

ALTER TABLE "fleet_members"
  ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approved_by" UUID,
  ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejected_reason" VARCHAR(500);
