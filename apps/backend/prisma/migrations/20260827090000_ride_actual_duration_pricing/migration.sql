-- DPX-PRICING-002 — charge the time a trip actually took.
--
-- `actual_duration_seconds` is completedAt − startedAt, the duration the final
-- time component is charged on. `quoted_total_fare` preserves the total the
-- passenger agreed to at booking, which `total_fare` now overwrites at
-- completion; without it a receipt could not explain the difference.
--
-- Both nullable with no backfill: rides completed before this shipped were
-- charged on the quote, and `quoted_total_fare = total_fare` would be a claim
-- about repricing that never happened.

-- AlterTable
ALTER TABLE "rides" ADD COLUMN     "actual_duration_seconds" INTEGER,
ADD COLUMN     "quoted_total_fare" DECIMAL(12,2);
