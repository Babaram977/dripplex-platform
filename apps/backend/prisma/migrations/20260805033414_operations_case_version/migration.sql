-- DPX-OPS-001 module-closure audit (2026-08-05)
--
-- Optimistic-concurrency guard for OperationsCase mutations. Founder
-- decision on the module-level production audit's concurrency finding:
-- two operators can realistically act on the same SOS/incident case at
-- once, and a stale write must be rejected rather than silently
-- overwriting a newer one. `version` starts at 0 for every existing row
-- and increments on every OperationsCasesService.updateCase() write.
-- Purely additive -- no data change, no locked behavior change.

-- AlterTable
ALTER TABLE "operations_cases" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
