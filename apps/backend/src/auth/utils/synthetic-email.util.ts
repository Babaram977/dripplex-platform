/**
 * Registration accepts either a real email or a phone number as the primary
 * identifier (see docs/AUTH-DPX-100-REALITY-AUDIT.md). `User.email` stays a
 * required, unique column in the schema on purpose -- making it genuinely
 * nullable would ripple through ~26 backend call sites and every
 * `NotificationService` method signature that reads `user.email` as a plain
 * string. Instead, a phone-only registration is given a deterministic,
 * internal-domain placeholder email derived from the phone number.
 *
 * This placeholder is never shown to the user (the registration response
 * echoes back `null` for `email` when none was given, not this value), never
 * receives a real send (see `isSyntheticEmail` usage in
 * `ProductionNotificationService`'s `sendEmail` helper, which skips the
 * provider call entirely for these addresses), and is treated as
 * automatically "verified" for account-activation purposes (see
 * `PrismaUsersRepository.activateIfVerificationsComplete`) since there is
 * nothing real to verify.
 *
 * Deterministic (not random) on purpose: the phone-uniqueness check already
 * run during registration guarantees this can never collide with another
 * user's placeholder, so no extra uniqueness check is needed here.
 */
export const SYNTHETIC_EMAIL_DOMAIN = 'phone.users.dripplex.internal';

export function makeSyntheticEmail(phone: string): string {
  const digitsOnly = phone.replace(/[^0-9]/g, '');
  return `${digitsOnly}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

export function isSyntheticEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`);
}
