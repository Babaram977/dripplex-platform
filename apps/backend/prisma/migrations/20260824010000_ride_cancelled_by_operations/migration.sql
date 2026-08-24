-- Operations-initiated ride cancellation.
--
-- A ride can strand: the driver's phone dies at the kerb, the passenger walks
-- off, and the row sits at ARRIVED or IN_PROGRESS forever — holding the
-- driver's activeRideCount at 1 so dispatch never offers them another trip.
-- Only the customer and the driver could cancel, and neither is reachable.
-- Operations now can, and the row must say so.
--
-- OPERATIONS is deliberately its own value rather than reusing SYSTEM: SYSTEM
-- is the automatic offer-expiry sweep. Attributing a human support decision to
-- the background job would make the cancellation audit trail unreadable.
--
-- Purely additive. ADD VALUE cannot fail on existing rows, and nothing writes
-- this value until the code that ships with this migration is deployed.

ALTER TYPE "RideCancelledBy" ADD VALUE IF NOT EXISTS 'OPERATIONS';
