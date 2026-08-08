-- DPX-DRIVER-015 — dedicated RegistrationChannel values for the admin portal
-- and operations console login endpoints. Additive only (new enum values); no
-- existing rows change. The JWT strategy round-trips the portal claim through
-- registrationChannelToPortal / portalToRegistrationChannel, so these channels
-- keep the admin/operations portal claim accurate instead of falling back to
-- the invite channels (which would stamp the wrong portal).
ALTER TYPE "RegistrationChannel" ADD VALUE 'ADMIN_PORTAL';
ALTER TYPE "RegistrationChannel" ADD VALUE 'OPERATIONS_CONSOLE';
