# DPX-DRIVER-007 — Driver Registration Completion

**Type:** Vertical slice — backend (schema/migration/DTO/service) + shared types + driver-portal UI.
**Branch:** `claude/driver-registration-completion`.
**Authorized:** founder, 2026-08-08, after live Figma verification of the two new registration
screens and reconciliation of the flow against the backend.

## Goal

Let a driver actually complete registration and reach the real `SUBMITTED` / Waiting-Approval
state. The backend already supported this end-to-end; the gap was the UI (no Emergency Contact,
Agreement, or Submit surface) plus two Figma fields the backend couldn't persist.

## Live Figma verification (2026-08-08)

Read live from the Figma Make source (`rsHHFRxHVE3OKv81p7m3K1`, read-only). Confirmed:
`EmergencyContactScreen` (progress 4/5) and `AgreementAcceptanceScreen` (progress 5/5) now exist.
Flow: **Vehicle → Emergency Contact → Agreement → KYC Status → Upload Docs → Submit for Review**.
The "Submit for Review →" CTA already exists in Figma on `DriverUploadDocsScreen`; no new Figma
screen was needed. Driver Splash/Login/OTP remain legacy/stale (single Super-App identity decision
stands).

## Founder decisions implemented

1. **Emergency Contact Relationship + optional Email are persisted** (real data, not display-only).
2. **Submit** uses the existing Figma-approved "Submit for Review" CTA, wired to
   `POST /driver/onboarding/submit`. No new Figma screen.
3. **Agreement version `"1.0"`** for this initial agreement.

## Changes

### Shared types (`packages/types`)

- `SubmitEmergencyContactRequest` += `emergencyContactRelationship` (required) + `emergencyContactEmail?`.
- `DriverProfileDto` += `emergencyContactRelationship` + `emergencyContactEmail` (nullable).

### Backend (`apps/backend`)

- `DriverProfile` schema += `emergency_contact_relationship` (VARCHAR 50) + `emergency_contact_email`
  (VARCHAR 255), both nullable.
- Migration `20260808000000_dpx_driver_007_emergency_contact_relationship_email` — additive, no backfill.
- `SubmitEmergencyContactDto` += `emergencyContactRelationship` (`@IsIn` the 7 Figma options:
  Spouse/Parent/Sibling/Child/Relative/Friend/Other) + optional `@IsEmail` `emergencyContactEmail`.
- `OnboardingService.submitEmergencyContact` persists the two new fields; `driver.mapper` exposes them.
- No new endpoints — the onboarding controller/SDK contract is unchanged (same request path, richer body).

### Driver-portal UI (`apps/driver-portal`) — adapted to the web idiom (`@dripplex/ui`), not the mobile palette

- New `/onboarding` page: sequential steps Vehicle → Emergency Contact → Agreement → KYC → Submit,
  reusing existing components.
- `EmergencyContactForm` += required Relationship dropdown + optional Email field.
- New `AgreementAcceptanceForm` (6 agreement sections + checkbox gate; version `"1.0"`).
- New `SubmitRegistrationCard` (activation-eligibility checklist + "Submit for Review" → submit;
  shows Waiting-for-approval / Under-review / Approved states; hides submit once submitted).
- Hooks: `useAcceptAgreement`, `useSubmitOnboarding`, `useActivationEligibility`, `useDriverOnboarding`
  (previously only `submitEmergencyContact` was wired; `acceptAgreement`/`submit` had no UI caller).

## Tests

- `driver-002-dto.validation.spec.ts` — relationship required, unknown relationship rejected,
  malformed email rejected, complete DTO accepted.
- `onboarding.service.spec.ts` — updated to pass the now-required relationship (real-Postgres path).

## Out of scope (documented, not invented)

- **No file-upload/storage** — KYC/vehicle documents remain hosted-URL strings (deferred per founder).
- No changes to the frozen ride/vehicle/inspection modules.
- Backend submission prerequisites (emergency contact + agreement + ≥1 KYC doc) are enforced
  server-side; the UI surfaces the backend's validation message rather than duplicating the rules.

## Verification

Consolidated typecheck / lint / test / build — see the PR description for results.
