# DPX-DRIVER-011 — Admin Vehicle Approval (Ops Console)

**Type:** Ops Console UI slice (uses existing backend/SDK/permissions — no backend change).
**Branch:** `claude/driver-vehicle-approval`.
**Authorized:** founder decision (2026-08-08) — "GREEN-LIGHT the core Approve/Reject vertical slice;
use existing backend/SDK/permissions; don't invent storage/document functionality."

## Why

The `vehicleApproved` check is one of the six activation-gate conditions, but **no UI approved
vehicles** — driver-submitted vehicles sat `PENDING` forever, so even after DPX-DRIVER-008 an
admin could never actually activate a driver. This closes that gap.

## Live Figma verification (2026-08-08)

Confirmed the **Ops Console "Vehicles"** screen exists in the live Figma Make source
(`AdminVehiclesScreen` / `PageVehicles`): a "Pending Vehicle Approvals" queue with per-vehicle cards
and **Approve / Request Corrections / Reject** actions. Implemented in `apps/operations-console`,
adapted to the existing `@dripplex/ui` web idiom (consistent with the `/drivers` review screen).

## Changes

**SDK (`packages/sdk`)** — no new methods; `AdminDriverVehiclesClient` (`list`/`approve`/`reject`)
already existed. Added `admin-driver-vehicles-client.spec.ts` (the client had no spec).

**Ops Console (`apps/operations-console`)**

- New `/vehicles` — vehicle-approval queue (status filter, default Pending) with inline
  **Approve** / **Reject** (reason) per pending vehicle. Uses `sdk.adminDriverVehicles`
  (`admin:drivers:vehicles:manage`).
- Hook `use-vehicle-approvals.ts` (list + approve/reject) following the established
  mutation→toast→invalidate pattern.
- Nav entry "Vehicle Approvals" added.

## Explicitly deferred (Figma features with no backend support — not invented)

- **Vehicle photo grid** (Front/Rear/Left/Right) — depends on file-upload/storage (deferred).
  `VehicleDto.photos` is a URL array with no upload path, so drivers can't submit photos yet.
- **Per-document checklist** (Insurance / Road Worthiness / Reg / Inspection) — no vehicle-document
  model exists; only `Vehicle.photos`.
- **"Request Corrections"** action — **no backend endpoint** (approve/reject only). Not built.

These remain founder/storage decisions (see DPX-DRIVER-009 readiness map). Nothing invented here.

## Scope / verification

- No backend, schema, migration, or permission changes.
- Typecheck / lint / test / build — see the PR description.
