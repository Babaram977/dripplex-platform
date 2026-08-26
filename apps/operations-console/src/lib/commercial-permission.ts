/**
 * The permission that gates the Commercial screen and its nav entry.
 *
 * Mirrors `COMMERCIAL_PERMISSIONS.ADMIN_CREDIT_SETTINGS_MANAGE` in the
 * backend's commercial.constants.ts. Held by `administrator` and
 * `super_administrator` only — `operations_staff` deliberately does not have
 * it, because editing credit policy is a heavier action than routine ops work.
 *
 * A literal rather than an import: the backend's constants are a Nest module
 * this app does not (and should not) depend on, and @dripplex/types carries
 * DTO shapes rather than the permission catalogue. The single source of truth
 * remains the backend — it enforces the permission on every request, so a
 * client that got this string wrong would fail closed with a 403, not open.
 */
export const COMMERCIAL_MANAGE_PERMISSION = 'admin:commercial:credit-settings:manage';
