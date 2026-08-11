-- DPX-DRIVER (task #15, interim) — MANUAL_REVIEW identity-verification provider.
-- Removes Smile ID as a hard launch dependency: an operations reviewer can
-- mark a driver's identity verified after reviewing their submitted ID/KYC,
-- satisfying DriverActivationService's identity gate without an external
-- vendor. Additive only (new enum value); no existing rows change. The
-- DrippleX-native device-biometric (WebAuthn) provider is a follow-up.
ALTER TYPE "IdentityVerificationProvider" ADD VALUE 'MANUAL_REVIEW';
