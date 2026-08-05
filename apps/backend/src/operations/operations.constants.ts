/** DPX-OPS-001 Slice 1 — one flat permission for every Live Operations
 * Dashboard read endpoint (fleet snapshot, live ride queue), matching the
 * "one flat permission per capability" precedent (e.g. Driver Slice 2's
 * `driver:shift:manage`). Read-only surface — no separate admin/driver
 * split needed the way mutating Driver Slice 2 endpoints had, since there's
 * only one audience (Operations staff) for this data. */
export const OPERATIONS_PERMISSIONS = {
  LIVE_READ: 'operations:live:read',
  /** DPX-OPS-001 Slice 2 — view-only access to the SOS/Incident/Support
   * work queues and the operations dashboard counters/activity feed. */
  QUEUES_READ: 'operations:queues:read',
  /** Assign/reassign, change priority/status, and add notes on a case.
   * `operations_staff` (the operators/supervisors this module exists for)
   * gets both this and QUEUES_READ; administrator/super_administrator get
   * both too, matching Slice 1's grant. */
  QUEUES_MANAGE: 'operations:queues:manage',
} as const;

/** DPX-OPS-001 Slice 2 — audit trail actions for `OperationsCasesService`
 * mutations. Every action is also recorded as an immutable
 * `OperationsCaseEvent` on the case itself (the operational timeline); the
 * audit log is the platform-wide security/compliance trail, the case
 * timeline is the operator-facing one — same split the rest of the
 * platform uses (e.g. `AuditLog` vs a domain's own status history). */
export const OPERATIONS_AUDIT_ACTIONS = {
  CASE_ASSIGNED: 'operations.case.assigned',
  CASE_PRIORITY_CHANGED: 'operations.case.priority_changed',
  CASE_STATUS_CHANGED: 'operations.case.status_changed',
  CASE_NOTE_ADDED: 'operations.case.note_added',
} as const;
