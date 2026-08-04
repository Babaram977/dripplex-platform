# DPX-DRIVER-004 — Vehicle Approval Lifecycle Policy (Future Milestone)

**Status: Deferred, not yet implemented.** Founder decision (2026-08-04), recorded
at Driver Slice 1's freeze: the one open design note from
`docs/DPX-DRIVER-002-INSPECTION-STANDARD.md` Phase 4 — _"should a failed
re-inspection automatically change `Vehicle.approvalStatus` from `APPROVED` to
another state?"_ — is a future product-policy decision, not a Slice 1 blocker.
The founder explicitly agreed with not hardcoding that behavior now. This
document exists so the decision has a name and a place to land, the same
discipline as `docs/DPX-DRIVER-003-BACKGROUND-SCREENING.md`.

## The gap this document will resolve

Today (Slice 1, as frozen): `Vehicle.approvalStatus` only ever moves _upward_ —
an admin can set it to `APPROVED` manually (`VehiclesService.approveVehicle`),
or `InspectionsService.decide()` sets it to `APPROVED` automatically when an
inspection passes. Nothing in the codebase ever moves it back to `PENDING` or
`REJECTED` after the fact — including when a _later_ re-inspection on that same
vehicle fails. `DriverActivationService.checkEligibility()`'s `inspectionPassed`
check works around this correctly today (it reads the vehicle's most recently
_decided_ `Inspection` directly, not `Vehicle.approvalStatus`, so a driver
cannot activate on a stale approval) — but `Vehicle.approvalStatus` itself can
still show `APPROVED` on a vehicle whose most recent inspection actually
failed, which is confusing for anyone reading the vehicle record directly
(an admin, a future UI, a report) without also cross-referencing
`Inspection`.

## Scope, once activated

The founder's own list of scenarios this policy should define, recorded
verbatim as the starting point — none of these are decided here, only
named so the eventual design doc doesn't start from a blank page:

- **Minor defect** — presumably does not immediately revoke approval;
  might allow a grace period or scheduled fix-and-reverify.
- **Major defect** — presumably does revoke approval, blocking the driver
  from going online in that vehicle until re-inspected.
- **Dangerous defect** — presumably immediate removal from service, possibly
  with a distinct urgency/notification path from "major."
- **Temporary suspension** — a vehicle-level state distinct from
  `REJECTED` (which implies never-was-approved) — a previously-good vehicle
  paused pending a fix.
- **Immediate removal from service** — the hardest stop; likely needs its
  own audit trail entry and driver notification, since it can affect a
  driver already mid-shift.
- **Re-inspection required** — already partially real (`Inspection.reinspectionOfId`
  exists and re-inspection scheduling works today); this policy would define
  _when_ a failed inspection automatically requires one versus leaving that
  to admin discretion.

Whether these become new `VehicleApprovalStatus` enum values, a severity
field on `Inspection`'s checklist items, or a separate defect-classification
model is a real schema design question for whenever this is picked up — not
assumed here.

## Why this deserves its own policy, not a quick patch

The founder's own reasoning, recorded because it's the actual justification
for deferring rather than guessing: this affects **operations** (who gets
notified, how fast), **customer safety** (a rider should never be matched to
a vehicle whose approval silently went stale), and **regulatory compliance**
(some defect classes may have legally-mandated response times in some
jurisdictions). Those are real product and legal decisions, the same class
of decision as DPX-DRIVER-003's background-check provider choice — not
something to encode as an implicit side effect of `InspectionsService.decide()`
without the founder explicitly weighing in on the scenarios above.

## What Slice 1 already provides for this to build on

So the eventual implementation doesn't have to guess at what exists:

- `Inspection.reinspectionOfId` — self-referencing link already supports
  chaining a re-inspection to the one that triggered it.
- `Inspection.status` (`SCHEDULED`/`PASSED`/`FAILED`/`CANCELLED`) and the
  officer-records/supervisor-decides split (`inspectorId` vs `decidedBy`) —
  whatever severity/defect classification this policy adds most naturally
  extends the existing checklist (`Inspection.checklist`, currently a flat
  pass/fail array) rather than replacing it.
- `DriverActivationService` as the single source of truth for activation —
  any new "should this vehicle's approval auto-revoke" rule plugs into the
  same service pattern (a dedicated method, not scattered inline checks),
  consistent with why that service exists at all.
