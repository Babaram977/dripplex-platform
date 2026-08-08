# DPX-DRIVER-008 — Admin Driver Review & Approval

**Type:** Vertical slice — SDK + backend wiring + Ops Console UI.
**Branch:** `claude/driver-admin-review-approval`.
**Authorized:** founder, 2026-08-08, as the **P0** slice from the consolidated Driver gap
audit, after live Figma verification that the admin review screens exist.

## Goal — close the approval loop

Registration Completion (DPX-DRIVER-007) let a driver reach `SUBMITTED`, but nothing downstream
could act on it: the lifecycle SDK (DPX-DRIVER-006) had no UI, driver-KYC verify/reject had no
SDK method, and the onboarding state machine was disconnected from the driver lifecycle. This
slice makes **Submitted Driver → Admin Review → KYC Review → Approve/Reject → Activation** work
end-to-end.

## Live Figma verification (2026-08-08)

Read live from the Figma Make source (`rsHHFRxHVE3OKv81p7m3K1`, read-only). The **Ops Console**
group contains the admin review design: `AdminDriversScreen` (driver roster + per-driver detail
with Suspend/Deactivate) and `AdminKYCScreen` (applications queue + per-document Approve/Reject +
selfie verify). This slice implements that flow in `apps/operations-console`, adapted to the
existing `@dripplex/ui` web idiom (consistent with every other Ops Console screen). Splash/Login/OTP
remain single-identity (not built).

## Changes

### SDK (`packages/sdk`)

- `AdminDriversClient` += `verifyKyc(kycId, remarks?)` and `rejectKyc(kycId, remarks)` — the two
  previously-uncovered `POST /admin/driver/kyc/:kycId/{verify,reject}` endpoints. Both return
  `DriverKycDto`. Client spec extended.

### Backend (`apps/backend`)

- `DriversService.approveDriver` / `rejectDriver` now keep the onboarding state machine in sync:
  approve → `DriverOnboarding.status = APPROVED`, reject → `REJECTED` (via `updateMany`, a no-op
  for legacy drivers with no onboarding record). This closes the "submission record is a dead-end"
  gap from the audit. Approval remains gated by the existing 6-check `DriverActivationService`.
- `drivers.service.spec.ts` extended (real-Postgres) to assert onboarding advances to APPROVED.
- No new endpoints, no schema/migration changes.

### Ops Console UI (`apps/operations-console`)

- New `/drivers` — driver applications queue (status filter, default Pending), rows link to detail.
- New `/drivers/[id]` — driver review: profile, activation checklist (`DriverActivationEligibilityDto`),
  KYC documents with per-document Verify/Reject, and Approve/Reject/Suspend/Reactivate (status-gated).
- Hooks `use-driver-approvals.ts` wire the lifecycle SDK (DPX-DRIVER-006, previously unused by any
  portal) + the new KYC methods, following the established mutation→toast→invalidate pattern.
- Nav entry "Driver Approvals" added to the Ops Console shell.

## Out of scope (per founder — P1/P2 held)

- No OPay, passenger verification, uploads/storage, commission/fare, seats, or document-type work.
- No selfie/liveness capture UI (Figma-gated, separate slice).
- KYC document images remain hosted-URL links (no file-upload backend).

## Verification

Consolidated typecheck / lint / test / build — see the PR description.
