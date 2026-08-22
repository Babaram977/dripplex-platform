-- Ride types a surcharge zone forbids outright.
--
-- Additive and defaulted, so every existing zone keeps its current behaviour:
-- an empty array is "no restriction".
ALTER TABLE "ride_surcharge_zones"
  ADD COLUMN "excluded_ride_types" "RideType"[] NOT NULL DEFAULT ARRAY[]::"RideType"[];
