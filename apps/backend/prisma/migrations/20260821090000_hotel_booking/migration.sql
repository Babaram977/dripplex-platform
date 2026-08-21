-- Hotel booking (DPX-HOTEL-001) — room types, per-night availability, bookings.
--
-- Entirely additive: three new tables and one new enum. Nothing existing is
-- altered, so every other feature is untouched.

CREATE TYPE "BookingStatus" AS ENUM (
  'PENDING_HOTEL', 'CONFIRMED', 'REJECTED', 'EXPIRED',
  'CHECKED_IN', 'CHECKED_OUT', 'NO_SHOW'
);

CREATE TABLE "room_types" (
  "id"          UUID PRIMARY KEY,
  "business_id" UUID NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,
  "name"        VARCHAR(120) NOT NULL,
  "description" VARCHAR(1000),
  "capacity"    INTEGER NOT NULL DEFAULT 2,
  "base_price"  DECIMAL(12,2) NOT NULL,
  "total_rooms" INTEGER NOT NULL,
  "photo_url"   VARCHAR(2048),
  "is_active"   BOOLEAN NOT NULL DEFAULT true,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  "deleted_at"  TIMESTAMP(3)
);
CREATE INDEX "room_types_business_id_idx" ON "room_types"("business_id");
CREATE INDEX "room_types_business_id_is_active_idx" ON "room_types"("business_id", "is_active");

-- A hotel cannot sell a negative number of rooms, nor more than it has.
ALTER TABLE "room_types"
  ADD CONSTRAINT "room_types_total_rooms_positive" CHECK ("total_rooms" >= 0);

CREATE TABLE "room_availability" (
  "id"             UUID PRIMARY KEY,
  "room_type_id"   UUID NOT NULL REFERENCES "room_types"("id") ON DELETE CASCADE,
  "night"          DATE NOT NULL,
  "rooms_open"     INTEGER NOT NULL,
  "rooms_booked"   INTEGER NOT NULL DEFAULT 0,
  "price_override" DECIMAL(12,2),
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL
);

-- One row per room type per night. This is what makes the availability upsert
-- safe and stops two calendars disagreeing about the same night.
CREATE UNIQUE INDEX "room_availability_room_type_id_night_key"
  ON "room_availability"("room_type_id", "night");
CREATE INDEX "room_availability_room_type_id_night_idx"
  ON "room_availability"("room_type_id", "night");

-- THE invariant this whole model exists to protect.
--
-- Enforced by the database, not by application code, because application code
-- races: two guests booking the last room at the same moment both read
-- "1 available" and both write "1 booked". A CHECK constraint is evaluated by
-- Postgres at write time and cannot be raced — the second transaction fails
-- and the second guest is told, rather than arriving at a desk at night to
-- find the room gone.
ALTER TABLE "room_availability"
  ADD CONSTRAINT "room_availability_not_overbooked"
  CHECK ("rooms_booked" >= 0 AND "rooms_booked" <= "rooms_open");

CREATE TABLE "bookings" (
  "id"                UUID PRIMARY KEY,
  "reference"         VARCHAR(40) NOT NULL,
  "customer_id"       UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "business_id"       UUID NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,
  "room_type_id"      UUID NOT NULL REFERENCES "room_types"("id") ON DELETE RESTRICT,
  "status"            "BookingStatus" NOT NULL DEFAULT 'PENDING_HOTEL',
  "check_in"          DATE NOT NULL,
  "check_out"         DATE NOT NULL,
  "nights"            INTEGER NOT NULL,
  "rooms"             INTEGER NOT NULL DEFAULT 1,
  "guests"            INTEGER NOT NULL DEFAULT 1,
  "total_amount"      DECIMAL(12,2) NOT NULL,
  "commission_amount" DECIMAL(12,2),
  "guest_name"        VARCHAR(160) NOT NULL,
  "guest_phone"       VARCHAR(20) NOT NULL,
  "guest_note"        VARCHAR(500),
  "accept_deadline"   TIMESTAMP(3) NOT NULL,
  "accepted_at"       TIMESTAMP(3),
  "rejected_at"       TIMESTAMP(3),
  "rejection_reason"  VARCHAR(500),
  "checked_in_at"     TIMESTAMP(3),
  "checked_out_at"    TIMESTAMP(3),
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "bookings_reference_key" ON "bookings"("reference");
CREATE INDEX "bookings_customer_id_created_at_idx" ON "bookings"("customer_id", "created_at");
CREATE INDEX "bookings_business_id_status_idx" ON "bookings"("business_id", "status");
-- The expiry sweep's query: everything still pending past its deadline.
CREATE INDEX "bookings_status_accept_deadline_idx" ON "bookings"("status", "accept_deadline");

-- A stay must be at least one night, and the departure day is never slept.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_checkout_after_checkin" CHECK ("check_out" > "check_in");
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_nights_positive" CHECK ("nights" >= 1);
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_rooms_positive" CHECK ("rooms" >= 1);
