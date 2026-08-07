# DPX-PROFILE-KYC-001 — Editable Profiles + Tiered KYC

Founder decisions recorded 2026-08-07, in response to the two blockers logged in
`docs/reference/dpx-100-figma-screen-mapping.md` §1 (Profile Setup, KYC/Identity Verification) and
`docs/reference/DPX-FIGMA-DIFF-REGISTER.md`. This document is the design/decision record required
before implementation began — nothing below was built until this was written.

---

## 1. Editable Profiles — Decision: YES

**No username.** DrippleX's stable identity is phone (primary), optional email, first/last name,
optional profile photo, optional date of birth, optional gender.

### Editable fields (`PATCH /auth/me`)

| Field             | Immediate or verification-gated | Notes                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `firstName`       | Immediate                       | length + character validation                                                                                                                                                                                                                                                                                                                                         |
| `lastName`        | Immediate                       | length + character validation                                                                                                                                                                                                                                                                                                                                         |
| `dateOfBirth`     | Immediate                       | new `User` column                                                                                                                                                                                                                                                                                                                                                     |
| `gender`          | Immediate                       | new `User` column, free-text/enum — modeled as optional string, not a closed enum, to avoid over-constraining                                                                                                                                                                                                                                                         |
| `profilePhotoUrl` | Immediate                       | new `User` column. **Dependency, not invented:** no file-upload/storage service exists in this backend today (confirmed absent — see `DPX-FIGMA-DIFF-REGISTER.md`'s existing note on `DriverKyc.frontImage`/`backImage` being URL-string-only). This field accepts a URL, same contract as `DriverKyc`, not a raw upload.                                             |
| `phone`           | **Verification-gated**          | Two-step: `POST /auth/me/phone/change` sends an OTP to the _new_ number; `POST /auth/me/phone/change/confirm` applies it only after the OTP is correct. Reuses `PhoneVerificationService`'s OTP primitives, does not reuse the `@Public()` pre-registration endpoints directly (those aren't scoped to an authenticated user changing an _existing_ account's phone). |
| `email`           | **Verification-gated**          | Same two-step pattern via `EmailVerificationService`, `POST /auth/me/email/change` + `.../confirm`.                                                                                                                                                                                                                                                                   |

### Read-only (server-managed, unchanged)

`id`, `roles`, verification/KYC status, wallet balances, referral code, `status` (account
standing), `createdAt`, `updatedAt`.

### Validation & audit

- `firstName`/`lastName`: 1–100 chars (matches existing DB column width), letters/spaces/hyphens
  only.
- `dateOfBirth`: must be in the past, reasonable age bounds (13–120 years) if provided.
- Every successful change (including phone/email confirmation) is recorded via the existing
  `AuditService.record()` — action `profile.updated` / `profile.phone_changed` /
  `profile.email_changed`, resource `User`, `resourceId` = the user's id.

### Explicitly not built this round

Interest-chip selection and the full onboarding `ProfileSetupScreen` stepper from the Figma
source are not wired — this design covers the account-management _editing_ capability
(`Account Management` screen), not the first-run onboarding flow, which the founder didn't ask
for by name. Logged as a follow-up, not silently dropped.

---

## 2. KYC — Decision: YES, tiered, risk-based

### Levels

| Level | Requirement                                           | Unlocks                                              |
| ----- | ----------------------------------------------------- | ---------------------------------------------------- |
| 0     | Phone verified (already true at registration)         | Browse, limited features                             |
| 1     | Personal info complete + email verified (if provided) | Normal consumer features                             |
| 2     | Government ID + selfie/liveness                       | Higher-value wallet features, regulated capabilities |

Driver/Merchant/Admin verification stays on its existing, separate, already-built pipeline
(`DriverKyc`, `DriverIdentityVerification`, `MerchantKyc`) — this design is for the **Customer**
persona only, a gap that pipeline doesn't cover.

### Lifecycle states (`CustomerKycStatus`)

`NOT_STARTED` → `IN_PROGRESS` → `PENDING_REVIEW` → `VERIFIED` | `REJECTED` | `EXPIRED` |
`REQUIRES_RESUBMISSION`. `REJECTED`/`REQUIRES_RESUBMISSION` can re-enter `IN_PROGRESS`. `EXPIRED`
is a terminal state reachable from `VERIFIED` (future: expiry-driven re-verification job — not
built this round, no expiry policy exists yet to drive it).

### Schema

New `CustomerKyc` model (parallel to `DriverKyc`, not a shared table — different persona, different
lifecycle richness, and driver KYC is already frozen/shipped; extending it risks regressing a
frozen module). Reuses the existing `KycDocumentType` enum (`NATIONAL_ID`, `PASSPORT`,
`DRIVER_LICENSE` all apply to a person's ID) rather than inventing new document type values.

```
CustomerKyc
  id, userId, level (CustomerKycLevel: LEVEL_0/1/2), status (CustomerKycStatus)
  documentType (KycDocumentType?), documentNumber?, frontImageUrl?, backImageUrl?, selfieUrl?
  reviewedBy?, reviewedAt?, remarks?, submittedAt?, createdAt, updatedAt
```

### Endpoints

- `GET /kyc/me` — current level + status + submitted document metadata.
- `POST /kyc/me/start` — begin Level 2 verification, creates/reopens a `CustomerKyc` row in
  `IN_PROGRESS`.
- `POST /kyc/me/submit` — attach document type/number + image URLs, moves to `PENDING_REVIEW`.
  **Same dependency as the profile photo field**: accepts URLs, does not itself provide file
  upload. A real capture-to-storage step is separate infrastructure work, not invented here.
- Admin review endpoints (approve/reject with remarks) — modeled on `DriverKyc`'s existing
  admin-review shape, permission-gated (new `kyc:customer:review` permission).

### Explicitly not built this round

- No verification-provider integration (Smile Identity, Persona, etc.) — the founder asked for a
  modular shape that a provider can plug into later, not a specific provider today. The
  `PENDING_REVIEW` state is designed to be filled by either manual admin review (built) or an
  automated provider callback (future, same state machine, no rework needed).
- No liveness/selfie capture UI — same file-upload dependency as above.
- No expiry job.

---

## 3. What "before continuing implementation" covers

This document, plus updates to `docs/reference/dpx-100-figma-screen-mapping.md` §1 status table and
`docs/reference/DPX-FIGMA-DIFF-REGISTER.md`'s Profile Setup entry, both updated in the same commit
as this file. Implementation (schema migration, services, controllers, SDK, frontend) follows in
subsequent commits on this branch, each independently verified (typecheck/lint/test/build) before
being marked done.

---

_Recorded 2026-08-07. Owner: founder. Compiled/maintained by: Claude, per DPX-INTEGRATION-001._
