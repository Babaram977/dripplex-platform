/** DPX-OPS-001 Slice 1 — one flat permission for every Live Operations
 * Dashboard read endpoint (fleet snapshot, live ride queue), matching the
 * "one flat permission per capability" precedent (e.g. Driver Slice 2's
 * `driver:shift:manage`). Read-only surface — no separate admin/driver
 * split needed the way mutating Driver Slice 2 endpoints had, since there's
 * only one audience (Operations staff) for this data. */
export const OPERATIONS_PERMISSIONS = {
  LIVE_READ: 'operations:live:read',
} as const;
