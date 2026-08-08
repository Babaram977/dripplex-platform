# DPX-DRIVER-006 — Admin Driver Lifecycle SDK

**Type:** SDK contract slice (no backend, no UI, no migration).
**Branch:** `claude/driver-admin-lifecycle-sdk`.
**Authorized:** founder, 2026-08-08, as the first _unblocked_ Driver slice following the
Driver kickoff audit. Emergency Contact and Agreement Acceptance remain **blocked** at the
UI/Figma stage and are explicitly out of scope here.

## Why

The Driver kickoff audit found that `AdminDriversController`
(`apps/backend/src/drivers/controllers/admin-drivers.controller.ts`) already exposes the full
admin driver-lifecycle surface, but `AdminDriversClient`
(`packages/sdk/src/drivers/admin-drivers-client.ts`) only covered the read endpoints
(`listDrivers`, `getDriver`, `getActivationEligibility`). The lifecycle actions
(`approve`/`reject`/`suspend`/`reactivate`) had **no SDK method**, so no portal could call
them — a pure SDK contract gap. The client's own JSDoc already flagged this. This slice
closes it; the backend was not touched.

## Scope — exactly the four lifecycle methods

Added to `AdminDriversClient`, mirroring the controller exactly. The HTTP client unwraps the
`{ success, data }` envelope, so each method resolves to the `data` payload (`DriverApprovalDto`).

| SDK method                        | HTTP | Path                           | Body         | Permission                 | Returns             |
| --------------------------------- | ---- | ------------------------------ | ------------ | -------------------------- | ------------------- |
| `approveDriver(driverId)`         | POST | `/admin/driver/:id/approve`    | —            | `admin:drivers:approve`    | `DriverApprovalDto` |
| `rejectDriver(driverId, reason)`  | POST | `/admin/driver/:id/reject`     | `{ reason }` | `admin:drivers:reject`     | `DriverApprovalDto` |
| `suspendDriver(driverId, reason)` | POST | `/admin/driver/:id/suspend`    | `{ reason }` | `admin:drivers:suspend`    | `DriverApprovalDto` |
| `reactivateDriver(driverId)`      | POST | `/admin/driver/:id/reactivate` | —            | `admin:drivers:reactivate` | `DriverApprovalDto` |

Contract facts verified against the backend before implementation:

- `reject`/`suspend` require a `reason` string, 5–1000 chars (`RejectDriverDto`/`SuspendDriverDto`
  in `apps/backend/src/drivers/dto/admin-driver-actions.dto.ts`). `approve`/`reactivate` take no body.
- All four endpoints respond `HTTP 200` and return `ApiSuccessResponse<DriverApprovalDto>`.
- `DriverApprovalDto` = `{ driverId, status, approvedAt?, approvedBy?, rejectedReason? }`
  (`packages/types/src/driver/index.ts`).
- `approve`/`reactivate` re-evaluate the unified activation gate (`DriverActivationService`)
  server-side; the SDK is a thin transport and adds no client-side logic.

## Tests

`packages/sdk/src/drivers/admin-drivers-client.spec.ts` (new) — the client previously had no
spec. Covers all seven methods (the three pre-existing reads plus the four new lifecycle
actions), asserting exact path, method, body, and `auth: true`, following the established
SDK client-spec convention.

## Explicitly NOT in scope

- No backend, controller, service, permission, or migration changes.
- No UI. No admin-portal / operations-console wiring (no UI currently references these; that is
  a separate, Figma-gated slice if/when an admin driver-management screen is designed).
- **Emergency Contact and Agreement Acceptance remain blocked** pending Production Figma screens.

## Verification

`pnpm --filter @dripplex/sdk typecheck` / `lint` / `test` — see the completion report for results.
