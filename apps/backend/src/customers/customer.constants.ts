/**
 * Operations Console customer roster (DPX-OPS — customer directory).
 *
 * Reading the customer directory is a plain user-record read, so it reuses the
 * existing `users:read` permission rather than minting a new one. That
 * permission is already granted to `operations_staff`, `administrator` and
 * `super_administrator` in the RBAC seed, so no seed change is required and the
 * roster surfaces in the Operations Console for exactly the roles that already
 * read driver/rider/merchant records.
 */
export const CUSTOMER_PERMISSIONS = {
  READ: 'users:read',
} as const;
