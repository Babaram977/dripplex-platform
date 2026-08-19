-- The passenger's 4-digit trip code, generated when a driver is assigned.
-- Nullable: rides created before this migration never had one, and a ride that
-- has not been assigned yet does not need one.
ALTER TABLE "rides" ADD COLUMN "verification_code" VARCHAR(8);
