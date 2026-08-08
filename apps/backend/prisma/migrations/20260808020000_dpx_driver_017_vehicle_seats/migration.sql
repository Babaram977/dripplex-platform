-- DPX-DRIVER-017 — passenger capacity as first-class operational data on Vehicle
-- (founder decision: must not be inferred from ride_category). Additive and
-- nullable: existing rows keep NULL (capacity unknown until updated) rather than
-- being backfilled with a fabricated number. New submissions require it at the
-- API layer (CreateVehicleDto).
ALTER TABLE "vehicles" ADD COLUMN "seats" INTEGER;
