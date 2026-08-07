-- DPX-PROFILE-KYC-002
-- Founder request 2026-08-07: capture distinct lifecycle timestamps on CustomerKyc
-- (startedAt/submittedAt/reviewStartedAt/verifiedAt/rejectedAt/expiresAt) rather than
-- relying on `updatedAt`, for auditing/reporting/reminders/compliance. Cheap to add now:
-- no service/controller/SDK/UI exists yet against this table, so no data migration risk.
--
-- Generated via `prisma migrate diff` against the local shadow database and hand-curated
-- to include ONLY the statements produced by this change. The shadow diff also surfaced
-- the same ~7 pre-existing drift statements documented in the prior migration in this
-- series (20260807120000_...) and in docs/REALITY-STAGE-R1.1.md -- excluded here for the
-- same reason.

-- AlterTable
ALTER TABLE "customer_kyc" ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "rejected_at" TIMESTAMP(3),
ADD COLUMN     "review_started_at" TIMESTAMP(3),
ADD COLUMN     "started_at" TIMESTAMP(3),
ADD COLUMN     "verified_at" TIMESTAMP(3);
