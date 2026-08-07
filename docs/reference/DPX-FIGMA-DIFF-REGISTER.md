# DPX-FIGMA-DIFF-REGISTER

Permanent, living register of every difference between the live Figma design and the real
DrippleX backend — founder-requested 2026-08-07. This is the launch checklist: as the founder
designs missing screens in Figma or the backend is extended, an item moves from "open" to
"resolved" here, and only then does the corresponding integration work happen.

**Standing rule this document exists to enforce:** integration work connects Figma to backend
exactly as each defines it. It never merges screens, splits screens, simplifies a flow, invents a
missing field, or fakes a missing backend capability to make a screen "work." Every difference —
however small — is logged here instead. See the permanent rule in
`docs/reference/dpx-100-figma-screen-mapping.md` for the full statement.

Columns: **Figma** (what the design specifies) · **Backend** (what actually exists) · **Action**
(what happens next, and who decides it — always the founder, never inferred).

---

## Screen-level differences

| Figma                                            | Backend                                                             | Action                                                                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Merchant onboarding & management (all screens)   | Fully live — `merchant.controller.ts`, ~30 SDK methods, DB complete | Waiting for founder Figma design. No UI built. **BLOCKED — no discussion until an approved design exists (2026-08-08).** |
| Two-Factor (2FA)                                 | No backend                                                          | Founder decision: build backend, or drop from scope                                                                      |
| Trusted Devices                                  | No backend                                                          | Founder decision                                                                                                         |
| Security Activity (self audit log)               | No backend                                                          | Founder decision                                                                                                         |
| Privacy Controls                                 | No backend                                                          | Founder decision                                                                                                         |
| Consent                                          | No backend                                                          | Founder decision                                                                                                         |
| Language & Region                                | No backend                                                          | Founder decision                                                                                                         |
| Accessibility                                    | No backend                                                          | Founder decision                                                                                                         |
| Linked Accounts                                  | No backend                                                          | Founder decision                                                                                                         |
| Emergency Protection (customer self, not driver) | No backend (driver-only `emergency` fields exist, not customer)     | Founder decision                                                                                                         |
| Connected Services                               | No backend                                                          | Founder decision                                                                                                         |
| Username Management                              | No backend                                                          | Founder decision                                                                                                         |
| Login Approvals                                  | No backend                                                          | Founder decision                                                                                                         |
| Recovery Codes                                   | No backend                                                          | Founder decision                                                                                                         |
| Security Questions                               | No backend                                                          | Founder decision                                                                                                         |
| Account Transfer                                 | No backend                                                          | Founder decision                                                                                                         |
| Account Suspension (self-service)                | No backend                                                          | Founder decision                                                                                                         |

Full per-screen status (including the ✅ Live majority) is tracked in
`docs/reference/dpx-100-figma-screen-mapping.md`, not duplicated here — this register is only the
differences that need a founder call.

## Field-level & behavioral differences (Auth — Profile Setup, DPX-INTEGRATION-001)

| Figma                                                                                                     | Backend                                                                                                                                                                                                                                                                                                                                                                                                                                       | Action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Profile Setup: avatar upload, Full Name edit, Username, Gender, Date of Birth, interest chips (6 options) | No self-service profile-update endpoint exists anywhere. `UsersController` only has admin `GET`/`DELETE` (permission-gated). `UsersService` has no `updateProfile`-style method. `AuthController` has `GET /auth/me` (read-only). "Username" has no field anywhere in the Prisma schema — a prior session's `packages/ui/.../MATURITY.md` already noted "there's no username concept at all." Gender/DOB/avatar/interests are equally absent. | **Not built.** Corrected from the mapping doc's prior "🟡 Partial — endpoint exists" claim, which was wrong (verified 2026-08-07 by reading `users.controller.ts`/`users.service.ts`/`auth.controller.ts` directly, not assuming). Founder decision needed: add a real profile-update endpoint + `username` field (backend work), or scope the screen down to fields that already exist (firstName/lastName only, via a new endpoint still not present today), or drop specific fields from the design. |

**Resolved 2026-08-07** — founder decision: yes, editable profiles, no username. See
`docs/DPX-PROFILE-KYC-001-DESIGN.md` for the full field list, endpoint shape, and
verification-gating rules for phone/email changes.

**Built 2026-08-07** — `PATCH /auth/me` (`ProfileService.updateProfile`), verification-gated
`POST /auth/me/phone/change` + `/phone/change/confirm` and `/email/change` + `/email/change/confirm`
(OTP-based, reusing `PhoneVerificationService`/`EmailVerificationService`'s OTP primitives without
touching their registration code path). SDK: `sdk.auth.updateProfile`/`requestPhoneChange`/
`confirmPhoneChange`/`requestEmailChange`/`confirmEmailChange`. Frontend: `SuperAppAuthEditProfileScreen`
at `/account/profile`, entered from the Account Management identity card (now tappable instead of
read-only). KYC (below) is schema-only as of this commit — service/controller/UI still pending.

## Field-level & behavioral differences (Driver Registration, DPX-100 Priority 1)

| Figma                                                                                                              | Backend                                                                                                                                                                              | Action                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vehicle Registration: "Passenger Seats" field                                                                      | `CreateVehicleRequest` has no seats field — only `rideCategory` (ECONOMY/COMFORT/XL/TRICYCLE)                                                                                        | Not built. Founder decision: add a `seats` column to `Vehicle`, or confirm `rideCategory` already covers this and drop the field for good.                                                                                                                                                                                               |
| Upload Documents: "Road Worthiness" document type                                                                  | `KycDocumentType` enum has no matching value                                                                                                                                         | Not built. Founder decision: add the enum value (backend work), or confirm it's out of scope.                                                                                                                                                                                                                                            |
| Upload Documents: "Passport Photo" document type                                                                   | `KycDocumentType` enum has no matching value                                                                                                                                         | Not built. Founder decision: add the enum value, or confirm out of scope.                                                                                                                                                                                                                                                                |
| Upload Documents: photo/document capture (camera / file picker)                                                    | `frontImage`/`backImage` are hosted-image URL strings only (`@IsUrl`) — no file-upload/storage backend anywhere in this codebase                                                     | Not built. Documented, not faked. Future work: an upload service (image → cloud storage → returns URL → URL sent to this same endpoint). No UI changes needed once that exists — the URL field is already the real contract.                                                                                                             |
| KYC Status: progress ring computed from a fixed 6-document mock checklist with a client-side completion percentage | `DriverProfileDto.kyc: DriverKycDto[]` is a free-form submitted-documents list — no required-checklist concept, no percentage field                                                  | Not built. KYC Status screen shows the real submitted-documents list and their real `verificationStatus` instead of a percentage ring. Founder decision: define a real "required documents" concept backend-side if the percentage/ring UX is wanted, or accept the list view as final.                                                  |
| Waiting Approval — no dedicated Figma screen exists for this state                                                 | `DriverActivationEligibilityDto` (`GET /driver/activation-eligibility`) fully models it: per-check pass/fail (identity, documents, vehicle, inspection, agreement, account standing) | **Built 2026-08-08, founder-authorized.** No Figma screen to preserve here, so this is a founder-directed addition, not an invented one — logged for transparency. Added to the existing `/driver-onboarding` hub (not a new route) for SUBMITTED/UNDER_REVIEW states: shows the real activation checklist plus a manual refresh action. |

## Resolved into the standard registers (2026-08-08)

The Driver Registration flow cannot actually reach SUBMITTED yet -- confirmed while finishing
Waiting Approval. `OnboardingService.submitForReview()` hard-requires an emergency contact and
agreement acceptance before it will move status to SUBMITTED, on top of the KYC doc already
built. Neither has a Figma screen among the 13 Driver App screens.

**Founder decision: this is not a special case needing its own resolution path -- it goes
through the same two registers everything else does.** Logged as:

- `Missing Figma Design Register` entries for "Driver Emergency Contact" and "Driver
  Agreement Acceptance" (`dpx-100-figma-screen-mapping.md`), both HIGH priority, both
  "Required Before: Driver Status DRAFT -> SUBMITTED".
- `docs/reference/DPX-BLOCKERS-REGISTER.md` BLOCKER #002 and #003 (CRITICAL -- blocks the
  entire Driver Registration workflow, not a minor gap).

Not built. No UI for either screen until the founder designs them in Figma -- the "build it
un-styled anyway" option raised when this was first found is off the table now that Merchant's
BLOCKED status confirmed the standing rule: no UI without Figma, no exceptions.

## Driver App placement & authentication (resolved, kept for the record)

| Figma                                                                                                                                      | Backend                                                                                                                    | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `App.tsx` routes Driver screens inside the same phone-frame consumer app (`Home → onDriverApp → drvsplash`)                                | Full driver-portal backend/SDK support already exists, portal-agnostic                                                     | Founder (2026-08-07): "code wins, comments lose." Driver is a first-class in-app Super App section, not deep-linked to a separate portal.                                                                                                                                                                                                                                                                                                                                                    |
| `DriverSplashScreen` / `DriverLoginScreen` / `DriverOTPScreen` — 3 screens, App.tsx routes `Home → drvsplash → drvlogin → drvotp → drvkyc` | The account is already authenticated in the Super App (same JWT session) — a second phone+OTP login has no backend purpose | Founder (2026-08-08): **one authentication system for the whole Super App**, same pattern as Uber/Grab/Careem — Splash → Welcome → Login/Register → OTP → Account Created → role detection → Consumer Home, with driver/merchant surfaced as roles in the drawer, not separate logins. `DriverSplashScreen`/`DriverLoginScreen`/`DriverOTPScreen` are confirmed **not to be built** — this is correct behavior for a single-identity Super App, not a gap. Kept here for the record, closed. |

---

_This document is append-only in spirit: new differences get added as they're found; resolved
items get their Action column updated (not deleted), so the history of what changed and when stays
visible. Owner: founder. Compiled/maintained by: Claude, per DPX-FIGMA-001._
