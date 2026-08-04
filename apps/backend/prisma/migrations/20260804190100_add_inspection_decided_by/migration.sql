-- DPX-DRIVER-002: track which supervisor made the final pass/fail decision,
-- distinct from which officer conducted the walkthrough (inspector_id).

ALTER TABLE "inspections" ADD COLUMN "decided_by" UUID;
