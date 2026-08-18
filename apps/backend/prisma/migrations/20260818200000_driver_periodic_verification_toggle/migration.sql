-- Periodic driver re-verification (first login of the day, idle gap, new
-- device) becomes switchable. Onboarding verification is unaffected.
--
-- Default TRUE preserves today's behaviour for anyone who has a biometric
-- provider configured; the service additionally refuses to demand a periodic
-- check when no provider is configured, because a check that cannot be
-- satisfied is not a control, it is a locked door.
ALTER TABLE "driver_security_settings"
  ADD COLUMN "periodic_verification_enabled" BOOLEAN NOT NULL DEFAULT true;
