-- DPX-HOTEL-002 slice E — telling a guest what happened to their booking.
--
-- Additive only: four enum values and one category. Postgres cannot add enum
-- values inside a transaction that also uses them, but `ALTER TYPE ... ADD
-- VALUE IF NOT EXISTS` on its own is safe to re-run, which matters because
-- `prisma migrate deploy` runs on every deploy.

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BOOKING_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BOOKING_CONFIRMED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BOOKING_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BOOKING_EXPIRED';

-- Not MARKETPLACE: a booking is not an order, and a guest filtering for "my
-- hotel bookings" is asking a different question from "my shopping".
ALTER TYPE "NotificationCategory" ADD VALUE IF NOT EXISTS 'BOOKING';
