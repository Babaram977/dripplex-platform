-- DPX-SAFETY-001 — the passenger's Emergency SOS screen raises a real alert.
--
-- Slice 2 shipped SOS as driver-only. Rather than add a second table (and
-- with it a second Operations queue a dispatcher could miss), the existing
-- `sos_alerts` row grows an origin discriminator and a customer column.
--
-- Every existing row is a driver alert, which is exactly what the enum
-- default encodes, so this needs no backfill and `driver_id` stays NOT NULL:
-- a customer may only raise SOS during an active ride, and an active ride
-- always has a driver.

CREATE TYPE "SosAlertOrigin" AS ENUM ('DRIVER', 'CUSTOMER');

ALTER TABLE "sos_alerts"
  ADD COLUMN "origin" "SosAlertOrigin" NOT NULL DEFAULT 'DRIVER',
  ADD COLUMN "customer_id" UUID;

-- SET NULL, not CASCADE: a life-safety record must outlive the account that
-- raised it. Deleting a customer must not erase the emergency they reported.
ALTER TABLE "sos_alerts"
  ADD CONSTRAINT "sos_alerts_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "sos_alerts_customer_id_idx" ON "sos_alerts"("customer_id");
