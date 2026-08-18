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

### Orders list (customer order history) — logged 2026-08-09 (customer nav-wiring repair)

| Figma                                                                                                                                                                                                                  | Backend                                                                                                                      | Action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No **Orders-list** screen. The 6 Marketplace screens (§4 of the mapping) cover Marketplace, Merchant Store, Product Detail, Cart, Checkout, **Order Tracking** (single order) — there is no order-history/list screen. | Order lifecycle backend + `sdk.orders` exist; per-order tracking route `/marketplace/tracking/[orderId]` is live in the app. | **Founder decision needed.** The customer nav previously carried an "Orders" item pointing at a dead `/dashboard#orders` anchor. During the 2026-08-09 minimal nav-wiring repair that item was **removed** (not repointed — there is no orders-list screen to point it at, and inventing one would violate the no-speculative-UI rule). Options: (a) founder designs an Orders-list screen in Figma (backend ready → then it becomes a Category-A connect), or (b) keep order access via tracking deep-links only and leave no top-level Orders nav. No UI built either way until decided. |

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

**Built 2026-08-07 (DPX-PROFILE-KYC-001 Slice 2)** — `CustomerKycService`/`CustomerKycController`
(`kyc/me` self-service: status/start/submit) and `AdminCustomerKycController`
(`admin/customer-kyc`: list-pending/get/verify/reject/request-resubmission), founder-locked
7-state lifecycle (`NOT_STARTED → IN_PROGRESS → PENDING_REVIEW → VERIFIED | REJECTED |
REQUIRES_RESUBMISSION`, `EXPIRED` reachable from `VERIFIED`) plus lifecycle timestamps
(`startedAt`/`submittedAt`/`reviewStartedAt`/`reviewedAt`/`verifiedAt`/`rejectedAt`/`expiresAt`).
SDK: `sdk.kyc.getStatus/start/submit`, `sdk.adminCustomerKyc.listPending/getForUser/verify/reject/
requestResubmission`. Frontend: `SuperAppAuthIdentityVerificationScreen` at
`/account/identity-verification`, entered from the Account Management "Identity Verification"
row. Same URL-string document-image constraint as `DriverKyc` (no upload/storage backend yet).
No in-app KYC notifications this round — deliberate scope cut, no `NotificationType` enum values
exist for KYC events yet.

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

## Customer self-registration wiring (Super App) — logged 2026-08-10

Wiring the Figma customer onboarding (`RegisterScreen → OTPScreen → ProfileSetupScreen`) to the
real `/auth/register/customer → /auth/phone/verify → /auth/login/customer` contract surfaced a
structural mismatch that required backend-mandated field additions. All deviations logged here and
**flagged for founder review**. Verified 2026-08-10 by reading the backend controllers/services
directly (`registration.controller.ts`, `registration.service.ts`, `phone-verification.controller.ts`,
`login.service.ts`, `portal-login.dto.ts`).

| Figma                                                                                                                                           | Backend                                                                                                                                                                                                                | Action                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RegisterScreen` collects **only** a phone number, then navigates straight to OTP.                                                              | `POST /auth/register/customer` requires `firstName` + `lastName` + `password` (min 8) **before** any OTP is dispatched; the phone OTP is only sent as a side-effect of a successful register. Login is phone+password. | **Built 2026-08-10, flagged for founder.** Added a **Full Name** and a **Password** field to `RegisterScreen` (styled to match the existing inputs) — the minimum inputs the real endpoint mandates. This is a backend-mandated deviation, not invented behavior: without them registration cannot be called at all. Founder decision: confirm these two fields on the register screen, or redesign onboarding to collect them elsewhere pre-OTP. |
| Figma onboarding **never collects a password** anywhere in the flow (phone → OTP → profile).                                                    | Both `/auth/register/customer` and `/auth/login/customer` require a password; there is **no passwordless / OTP-login path** on the backend (`PortalLoginDto.password` is required, min 8).                             | Same as above. The password captured at register is reused for the immediate post-verify login and is held **in memory only** (never persisted to storage). Founder decision: keep password auth (current), or add a passwordless OTP-login backend path if a password-free onboarding is wanted.                                                                                                                                                 |
| OTP screen calls `api.auth.verifyOtp` at `POST /auth/otp/verify`.                                                                               | **No `/auth/otp/*` route exists.** The real phone verification is `POST /auth/phone/verify { phone, otp }`, which activates the account (`PENDING_VERIFICATION → ACTIVE`). Email is token-based under `/auth/email/*`. | **Fixed 2026-08-10 (correctness).** SDK now exposes `sendPhoneOtp`/`verifyPhoneOtp`/`resendPhoneOtp` (`/auth/phone/*`) and corrected `verifyEmail`/`resendEmailVerification`/`sendEmailVerification` (`/auth/email/*`). The dead `verifyOtp`/`requestOtp`/`verifyPhone` methods (nonexistent routes) were removed. `OTPScreen` now verifies the phone, then logs in and persists the session.                                                     |
| `ProfileSetupScreen` shows a **Username** field with an availability checker (mock `TAKEN_NAMES` set).                                          | "No username" is a **locked founder decision** (identity = phone primary + optional email + name). No username field exists anywhere in the schema.                                                                    | **Removed 2026-08-10.** The mock username field + `TAKEN_NAMES` were deleted from `ProfileSetupScreen` to align with the locked decision. The screen now pre-fills the real registered name and persists edits via `PATCH /auth/me` (`updateMe`, best-effort/non-fatal).                                                                                                                                                                          |
| Standalone **Username Management** screen (`screensD` `UsernameScreen`, `username` route) + `@username` shown on the profile card (`screensB`). | Same locked "no username" decision — no backend.                                                                                                                                                                       | **Not yet removed (out of registration-flow scope).** These are separate account-area artifacts that still contradict the locked decision. Logged here for a follow-up cleanup pass; not ripped out in this change to avoid touching unrelated account screens.                                                                                                                                                                                   |

**External dependency (verified live, not a blocker):** live self-registration needs a real SMS
OTP delivered to a brand-new phone. Confirmed 2026-08-10 that prod backend has `TERMII_API_KEY` +
`TERMII_SENDER_ID` (SMS) and `RESEND_API_KEY` + `RESEND_FROM_EMAIL` (email) set, and
`ProductionNotificationService` dispatches phone OTP via Termii when the key is present (log-only
fallback otherwise). So a new customer registering with a valid phone should receive an SMS code.

### Partner self-onboarding (merchant/driver/rider) — logged 2026-08-10 (Figma onboarding wiring)

Figma generated `onboardingScreen.tsx` (role picker → merchant/driver/rider sign-up → driver
documents → pending review), wired into the super-app this session.

| Figma                                                                                      | Backend                                                                                                                                                                                                      | Action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Merchant sign-up collects **Business Name + Business Type (retail)**                       | `PortalRegistrationDto` has no business fields; `PATCH /merchant/business` (`UpdateBusinessDto`) exists; `businessType` is the **legal-structure** enum (SOLE_PROPRIETORSHIP/…/OTHER), NOT a retail category | **Resolved 2026-08-10:** added a post-login **Business Details** step (`BusinessDetailsScreen`) that persists Business Name + legal **Business Structure** + optional description/phone/address via `PATCH /merchant/business`. The signup's retail "Business Type" (Restaurant/Supermarket/…) has no dedicated backend field → carried into `description` (prefilled, editable). Merchant flow: register → email OTP → login → **Business Details** → pending review.                                                                                                                              |
| Driver documents screen uploads **license/vehicle-reg/guarantor images** + vehicle details | Driver KYC (`POST /driver/kyc`) requires image **URLs**; file-upload/storage service now exists (R2, `POST /uploads/sign`)                                                                                   | **Resolved 2026-08-10 (DPX-RIDER-002 PR):** storage shipped (Cloudflare R2), so `DriverDocumentsScreen` is now fully wired — the three documents upload to the `kyc-documents` folder via signed PUT, submit as `POST /driver/kyc` ×3, then register the vehicle via `POST /driver/vehicles`. Driver routes through the docs step post-OTP while authenticated. One visual deviation from Figma: a **Year** field was added to the vehicle form (the `CreateVehicleDto` requires `year`; Figma's form has make/model/plate/colour/category/seats only) — Seats moved into a 2-column row with Year. |
| All three verify via the existing **email OTP** screen                                     | `POST /auth/verify/email` + `PORTAL_EMAIL_ACTIVATION` (PR #95)                                                                                                                                               | Wired: register → email code → portal login → pending review. Activation requires `PORTAL_EMAIL_ACTIVATION=true` (set on prod).                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Pending-review checklists (merchant 3-step, driver 6-check, rider 2-step)                  | Merchant/driver approval = Admin endpoints; **rider approval not built**                                                                                                                                     | Checklists are **static** (design), not live status. Rider approval backend is being built (Piece C); live status wiring follows once approval endpoints exist.                                                                                                                                                                                                                                                                                                                                                                                                                                     |

### Rider document KYC + company name (DPX-RIDER-002) — logged 2026-08-10

Founder request: give delivery riders a document-KYC flow (**ID + Guarantor ID**) and a
**company name** (name only), plus a company/KYC view on the Operations Console rider profile.
Reconciled against the live Figma Make (`rsHHFRxHVE3OKv81p7m3K1`, `onboardingScreen.tsx`) —
the visual source of truth — on 2026-08-10.

| Figma (source of truth)                                                                                                                                                                                               | Implementation                                                                                                      | Action / rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~No rider documents screen exists in Figma.~~ **Resolved 2026-08-10 — rider Upload Docs frame now added to Figma.** (Was: rider flow was sign-up → OTP → Pending Review; only the driver had an Upload Docs screen.) | New `RiderDocumentsScreen` in the super-app                                                                         | **Resolved 2026-08-10.** The screen was first built in code by reusing the Figma driver "Upload Docs" design verbatim — same `DocumentCard`, `SectionDivider`, `FieldGroup`, `GreenBtn`, `StatusBar`, `Ambient`, and `BG`/`NAVY_CARD`/`PP`/`IT` tokens — scoped to the rider (Government ID + Guarantor ID + a Company section, no vehicle block). The founder then added the matching **`RiderDocumentsScreen`** frame to the Figma Make file (prompt in `DPX-RIDER-002-figma-rider-documents-prompt.md`). Re-pulled and verified 2026-08-10: the Figma frame matches the shipped code (identical shell, two document cards, Company-name field + helper, Submit button); the code additionally gates submit on the uploaded files and calls the real `POST /rider/kyc` + `PATCH /rider/profile` — the expected functional-wiring layer on top of the shared visual design. Figma `RIDER_STEPS` also gained a "Documents submitted" step. **Design and code are in parity.** |
| Rider flow routes straight to Pending Review after OTP                                                                                                                                                                | Rider persona now routes OTP → **`riderdocs`** → Pending Review                                                     | Deviation driven by the new KYC step; the rider uploads while authenticated (`rider:kyc:manage`), matching the driver pattern.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Company name — not present anywhere in Figma                                                                                                                                                                          | Single "Company name" field (optional) in the rider docs Company section; `PATCH /rider/profile`                    | Founder scope: "just name of company, no need much details." One field only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Operations Console rider detail — not a Figma-designed surface (Ops Console is the Next.js `@dripplex/ui` admin, outside the consumer Figma)                                                                          | Added **Company** card (name only) + **KYC documents** card (type/number/status/view link) to the rider detail page | The Ops Console has its own design system, not governed by the consumer Figma; the cards follow existing `@dripplex/ui` `Card`/`Badge` patterns already on that page.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

---

_This document is append-only in spirit: new differences get added as they're found; resolved
items get their Action column updated (not deleted), so the history of what changed and when stays
visible. Owner: founder. Compiled/maintained by: Claude, per DPX-FIGMA-001._

---

### Super-app dead-button wiring pass — logged 2026-08-11

The deployed super-app is the Figma "Design Preview" build (a screen catalog navigable from
the left sidebar). Many Figma-generated buttons shipped with no `onClick`. A full audit of
~20 screen files (66 candidate buttons) was done; primary buttons were wired to existing
route keys, and the rest are recorded here as **gaps** (unbuilt feature / no route / no
backend) rather than faked, per §3 "document gaps, don't invent."

**Wired (existing routes/handlers):**

| Area                | Button(s)                                                                                           | Destination                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Home                | Wallet nav tab, Send/Receive/Top Up/Pay, Quick-Actions grid, "View Store"                           | wallethome / wallettransfer·wallettopup·walletpay·wallethome / marketplace·ride·wallethome·orderhistory / store |
| Marketplace + Store | cart icon (was dead on both headers), nearby-store "Order"                                          | cart / store                                                                                                    |
| Product detail      | "Buy Now"                                                                                           | add-to-cart → checkout                                                                                          |
| Ride                | cancel ride, share trip, Emergency (SOS), skip-tip, report issue (RideDetail + TripReceipt), rebook | ridehome / rideshare / ridesos / riderating / ridereport / ridehome                                             |
| Wallet              | surfaced the "Rewards" tile (prop+route already existed)                                            | walletrewards                                                                                                   |
| Driver / Rider      | Sign Out, "Apply to join" (both portals)                                                            | drvlogin·riderlogin / partnerdriver·partnerrider                                                                |
| Settings            | Trust Center + Auth Summary recommendation actions                                                  | emailverify / recoverycodes / kyc                                                                               |

**Gaps — intentionally NOT wired (no route / unbuilt backend / stated dependency):**

- **Telephony / in-app chat**: ride Call/Message tiles, driver "call passenger", tracking
  "Message", recovery "Chat" — no voice/SMS/chat capability exists.
- **File upload / device**: avatar-edit (✎) on profile screens, driver "Camera", ride
  "Attach photo" — depend on the not-yet-built storage/device APIs.
- **Promo / campaign**: home & marketplace promo/deal CTAs, checkout applied-promo "Remove" —
  no campaign route or applied-promo state.
- **Static demo data**: marketplace "Add to Cart" on Trending, home Recs product cards,
  store-grid add-to-cart persistence — mock items lack real product/merchant IDs.
- **Missing destination screens**: driver Statement, Change PIN / Privacy / Terms / Help rows,
  "View full Driver Agreement", "Forgot PIN?", data-export "Request", "Report Device",
  "Remove All Other Devices", Print/Download — no corresponding screen/route exists.
- **Search / share icons**: search bar mic/QR, filter, share glyphs — search & native share
  features are unbuilt.
- **OTP "Contact Support"**: the only in-app target is the Ops Console `adminsupport` mock
  (no `onBack`, no backend); not wired to avoid dropping customers into an ops-side dead-end.
- **Embedded Ops Console / Admin mock** (`adminConsoleScreen.tsx`, 0 API calls): a visual
  duplicate of the real `apps/operations-console` Next.js app. Its buttons (Save Changes,
  Change Password, Revoke, report date-presets) are intentionally inert — the functional
  Operations Console is the separately-deployed app, not this preview.

---

### Merchant product model — base price + variants wiring (DPX-MERCHANT-003) — logged 2026-08-11

The merchant Products screen was wired to a flattened UI shape (`price` / `published` /
`inStock` / `category` name / `imageUrl`) that does not match the real backend `ProductDto`
(`basePrice` + `variants[]`, `status` enum, `inventory`, `images[]`, `categoryId`). The read
path already mapped the raw entity to that flat shape, but the **write** path was broken —
create/update sent fields the backend ignores, publish/stock were PATCHed as non-existent
fields, and there was no variants UI at all.

Founder decision (2026-08-11): the merchant portal manages **base price + variants** (the
full model), not a single flat price.

Wiring done in this pass (verified against the backend contract in
`apps/backend/src/products/*` — controllers, DTOs, mapper):

| Concern  | Real backend contract                                                                                       | Implementation                                                                                    |
| -------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Price    | `basePrice` (Decimal) + per-variant `priceOverride`                                                         | Create/Update send `basePrice`; variants carry optional `priceOverride`.                          |
| Publish  | `POST /merchant/products/:id/publish` \| `/unpublish` (status transition, asymmetric: unpublish → ARCHIVED) | Publish toggle calls the dedicated endpoints, not a PATCH field.                                  |
| Stock    | `PATCH /merchant/products/:id/stock-status { outOfStock }` → `inventory.manuallyDisabled`                   | In-stock toggle calls stock-status; read `inStock` = `available > 0 && !manuallyDisabled`.        |
| Category | `categoryId` (UUID)                                                                                         | Real category dropdown from `GET /categories` (id → name); create/update send `categoryId`.       |
| Variants | `POST/PATCH/DELETE /merchant/products/:id/variants { name, sku?, priceOverride? }`                          | Variants section in the product editor (add/list/remove); only available once the product exists. |
| Images   | `images[]` via `/images` sub-endpoints                                                                      | Still read-only (first image shown); full image management deferred — logged below.               |

**Open dependency (Figma):** the variant editor + category picker reuse the existing merchant
design-system components (`MxCard`/`MxInput`/`MxSelect`/`MxBtn`) because there is no Figma frame
for merchant variant/inventory management yet — same pattern as the rider-documents work
(DPX-RIDER-002): built on the shared design system, to be reconciled when the founder adds the
matching Figma frames. Product **image upload** and per-variant **inventory** remain deferred
(no design; backend supports images via `/images` and inventory via `/inventory`).

**Verification status:** render-safe (super-app builds clean; a Playwright crawl of the Merchant
screens shows 0 pageerrors). End-to-end write-path verification against a live backend is
**pending** — it could not be run from the build sandbox (the local stack was reclaimed and the
production backend is egress-restricted). The endpoint paths/payloads are grounded in the real
backend controller/DTO source, so this is a live-smoke gap, not a contract guess.

---

### Customer home — dead controls activated (DPX-HOME-001) — logged 2026-08-18

Founder testing (2026-08-18, customer Abdullahi) found a set of controls on the customer home
screen that looked tappable and did nothing. The pass below activates what has a real
destination, and marks what does not so no control silently swallows a tap.

**Activated against real endpoints / real screens:**

| Control                      | Was                                                      | Now                                                                                                                                                                                              |
| ---------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Search bar                   | A `<p>` with placeholder text — not typable              | A real `<input>`. Debounced 350ms into `GET /merchants/smart-search` + `GET /products/smart-search`, results listed inline; Enter searches immediately; a clear button restores the browse view. |
| Category chips               | `setActive` only — moved a highlight, filtered nothing   | A chip writes its label into the same search box and runs the same search. Chips and the bar are one mechanism, which is what makes both of them do something. Tapping the lit chip clears it.   |
| Search / category results    | Did not exist                                            | Merchant and product rows; both open the merchant's store (`onStore`), the only destination that exists for both today. Loading, empty and error states with Retry.                              |
| "See all" — Nearby Merchants | `onAll={() => {}}`                                       | Marketplace.                                                                                                                                                                                     |
| "See all" — Recommended      | `onAll={() => {}}`                                       | Marketplace.                                                                                                                                                                                     |
| "See all" — Recent Activity  | `onAll={() => {}}`                                       | Wallet.                                                                                                                                                                                          |
| Recent Activity rows         | Inert `<div>`s (data itself was already the real ledger) | Buttons opening Wallet, where the full ledger lives. There is no per-transaction detail screen to route to, so all rows go to the one place that can show more.                                  |

**Marked "SOON" rather than invented** — Quick Actions `Utilities`, `Health`, `More` have no
screen and no endpoint. They are dimmed, `disabled`, and carry a SOON badge (absolutely
positioned so the 4×2 grid does not shift). No destination was invented for them; they need a
founder decision on scope before anything is built.

**Removed — no contract to build against:** the mic and QR-scanner buttons that flanked the
search bar. Both were `<button>`s with no handler, and there is no voice-search or QR endpoint.
Recorded here as a gap; they return when there is a contract, not before.

**Also in this pass (founder request, same session):**

- The full-bleed wallet balance card was moved off home. The Wallet screen already owns the
  balance, income, spend and the Send / Receive / Top Up / Pay actions, so nothing is lost.
- The Marketplace · Ride · Wallet service switcher was removed: its `svcTab` state was written
  and never read anywhere in the file, so the tabs only moved a highlight while the page below
  never changed. Quick Actions and the bottom navigation are the real routes.
- Merchant header: the red/fire colouring was dissolved to brand green (`G0`/`G2`/`G3`) on the
  live pulse dot, the order-card strip, the dashboard banner and the New Order badge. `C_ERR`
  is now used only where something is genuinely wrong — rejected, suspended, action-required,
  errors.

**Browse-mode section order is unchanged from the Figma.** Search results replace the browse
sections rather than being inserted among them, so the default screen — the one compared
against the design — does not move.

**Verification:** super-app builds clean; a Playwright pass over the built bundle confirms the
search input is real and editable, typing reaches smart-search, merchant and product results
render and navigate, a category chip fills the box and returns its own results, clearing
restores the browse view, the three unbuilt tiles are marked SOON while the built ones stay
live, Recent Activity shows the real ledger, and its "See all" reaches the Wallet.

---

### Type and icon rendering — sharpening pass (DPX-HOME-002) — logged 2026-08-18

Founder asked for sharper, cleaner icons and type ("Talabat standard"), and confirmed the
scope as **polish only — no Figma drift**: no layout, colour or component changes. Everything
below is rendering quality, not design.

**What was actually wrong** (measured in a browser against the built bundle, not assumed):

| Defect                                                                                                          | Effect                                                                                   | Fix                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `Inter` was loaded at weights 300;400;500;600 while ~295 elements ask for `font-bold` (700)                     | Browser synthesised bold by smearing the 400 weight — the single biggest source of blur  | Weight list now `400;500;600;700;800` for Inter, `400;500;600;700;800;900` for Poppins (matches actual use, incl. the 900 ride fare) |
| Fonts pulled by `@import` from `src/styles/fonts.css`, itself `@import`-ed from `index.css`                     | Two round trips before the first font byte; text painted in fallback sans, then reflowed | One `<link rel="stylesheet">` plus `preconnect` in `index.html`, seen by the preload scanner                                         |
| `merchantScreen.tsx` and `adminConsoleScreen.tsx` each `@import`-ed Google Fonts again from a runtime `<style>` | Third round trip on mount, for a _narrower_ weight range than the app uses               | Removed; both now use the single document-level link                                                                                 |
| `-webkit-font-smoothing: auto`                                                                                  | Subpixel rendering thickens and colour-fringes light-on-dark glyphs                      | `antialiased` / `grayscale` on `html`, plus `font-optical-sizing: auto`                                                              |
| `shape-rendering: auto` on inline SVG with fractional strokes (1.5 / 1.8 / 2.2)                                 | Strokes land between pixels inconsistently                                               | `shape-rendering: geometricPrecision`                                                                                                |
| `ImageWithFallback` placeholder emoji fixed at `2.25rem`                                                        | Overflowed a 40px avatar slot, sat undersized in an 82px card banner                     | Scales to its container (`55cqw`, `container-type: inline-size`), fixed size kept as the `@supports` fallback                        |
| Merchant/product `<img>` decoded on the main thread                                                             | A large logo could stall the frame it appears in                                         | `decoding="async"` (caller-overridable)                                                                                              |

**Verified in a browser:** one Google Fonts request instead of three, the request now includes
`Inter:wght@…700…`, `document.fonts.check('700 16px Inter')` passes, `html` computes
`antialiased`, SVG computes `geometricprecision`, the fallback emoji renders 30.8px inside a
56px box (was a flat 36px), and opening the Merchant portal triggers no further font request.

**Ceiling, and the founder decision behind it.** The interface icons are **emoji** (🛒 🍽 💊
in Categories, 🛍 🚖 💳 in Quick Actions). Emoji are supplied by the platform, so how sharp
they look is decided by the device, not by us — no amount of CSS changes that. Talabat's
crispness comes from a **commissioned vector icon set**, which is a design deliverable, not a
rendering setting. Replacing emoji with SVG icons would change components and drift from the
Figma, so it is **not** done here. Raising the ceiling needs an icon set added to the Figma
first — flagged for founder decision.

---

### Ride pricing console — fares out of code, airport surcharge zones (DPX-PRICING-001) — logged 2026-08-18

Founder direction (2026-08-18): _"trip to airport is more expensive it should be determine in
pricing console"_, scoped to the **full Ops-editable console**.

**What was there before.** Ride fares were `RIDE_FARE_RATES`, a hardcoded constant in
`apps/backend/src/rides/ride.constants.ts` that still carried its own warning that it was
_"not a founder-approved fare table"_. Changing any price meant a code change and a deploy.
There was no surcharge, zone, venue or surge concept of any kind, and no pricing screen
anywhere in the Ops Console.

**What exists now.**

| Piece                  | Detail                                                                                                                                                                                                                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ride_fare_rates`      | One row per ride type — base, per-km, per-minute, minimum. Seeded from the constants that were in force, so the first fare quoted after the migration matches the last one quoted before it.                                                                                                                                           |
| `ride_surcharge_zones` | Named circle (centre + radius). `FLAT` naira or `MULTIPLIER` factor; triggers on `PICKUP`, `DROPOFF` or `EITHER`; deactivatable.                                                                                                                                                                                                       |
| Ride snapshot          | `surcharge_amount`, `surcharge_zone_id`, `surcharge_zone_name` on `rides`. The **name** is snapshotted so a receipt still reads "Airport" after the zone is renamed or switched off. FK is `ON DELETE SET NULL` — deleting a zone must never delete the trips it priced.                                                               |
| Ops Console            | `/pricing` — edit the fare table per type, create zones, switch them on and off.                                                                                                                                                                                                                                                       |
| Permission             | `admin:rides:pricing:manage`, granted to `administrator` and `super_administrator` **only**. Deliberately _not_ a reuse of `admin:rides:support`, which `operations_staff` holds: refunding a trip must not also grant repricing the platform. Asserted in `ride.permissions.spec.ts` against the controller's own decorator metadata. |
| Audit                  | Every rate change and zone create/update records the actor and the before/after. A fare change is a commercial act.                                                                                                                                                                                                                    |

**Fare order of operations** — metered = base + distance + time; the surcharge applies to the
metered fare; the minimum is a **floor under the result**, never an addition. A short surcharged
trip still lands on the ₦1,500 minimum.

**Founder-locked ₦1,500 minimum** is preserved exactly: the migration seeds it for every ride
type. The column is per-type so a rate can be varied later without another migration; the value
shipped is the single locked figure applied across the board.

**⚠️ Engineering choice awaiting founder confirmation — overlapping zones do not stack.** When
a trip falls inside more than one active zone, **only the zone that adds the most is applied**.
The reasoning: a passenger crossing two overlapping zones should not be charged twice for one
journey, and a single predictable line is easier to explain on a receipt than an arithmetic
chain. This is not a founder decision and is easy to change to "sum the flats, compound the
multipliers" if that is the commercial intent. Flagged here rather than left implicit.

**No zones are seeded.** Where the Kano airport boundary sits and what the run should cost are
commercial decisions; inventing a radius and a price would put a number on a customer's receipt
that nobody chose. The console creates them.

**Known cost:** `resolveSurcharge` runs one indexed query against active zones per fare
estimate. With a handful of zones this is negligible; if the zone count ever grows into the
hundreds it should be cached, and the bounding-box narrowing already used for driver search
applied to zones too. Noted rather than pre-optimised.

**Not in scope, and not invented:** surge/demand pricing, time-of-day pricing, per-city rate
tables, and polygon zones. A circle was chosen because an operator can set one up from a map pin
and a distance without a GIS tool. Any of these can follow a founder decision.

**Verification:** backend suite **207 suites / 1684 tests** green against real Postgres and
Redis, including flat and multiplier surcharges, pickup-only and dropoff-only triggers, inactive
zones ignored, a zone the trip never touches ignored, overlapping zones resolving to the larger
alone, a surcharged short trip still floored at the minimum, the rate table seeding from the
constants, rejection of a multiplier below 1 (which would discount every trip through the zone),
and the permission-catalog count guard updated deliberately from 121 to 122.

---

### Partner account rows + why a driver is still pending (DPX-PARTNER-001) — logged 2026-08-18

Two things from founder testing on 2026-08-18.

#### 1. "Drivers that have taken inspection and submitted all documents are still showing pending"

**Not a bug in the approval flow — a gap in what the roster tells you.** Driver approval is a
manual admin action (`DriversService.approveDriver`) behind a six-check gate
(`DriverActivationService`): identity verified, required documents verified, an approved active
vehicle, that vehicle's latest _decided_ inspection passed, agreement accepted, account not
locked. The Ops roster showed a column of identical `Pending` badges and nothing about which
check was outstanding, so an operator had to open every driver in turn to find out.

The roster now carries `activationBlockers` per driver, computed for the whole page in four
queries via a new `DriverActivationService.checkEligibilityBulk`. An **empty array** means
"nothing outstanding, waiting only on an operator's click" and the row says exactly that.

A spec pins the bulk path to the single-driver path check-for-check: the roster reads one and
the detail page reads the other, and if they ever diverge the roster is telling an operator
something the Approve button will contradict.

**⚠️ Likely blocker for the founder's specific drivers, flagged not assumed:** `identityVerified`
is set only by (a) an admin marking identity verified in the console, or (b) an IDV provider
result. **No IDV provider is built** (task #15 — Smile ID was removed as a launch dependency and
the DrippleX-native replacement is not built). So on a fresh driver that check can only be
cleared by hand today. This cannot be confirmed from the build sandbox — production is
egress-restricted — so it is stated as the most likely cause, not as fact. Opening any pending
driver in the console shows the real answer.

#### 2. Dead rows on the driver and rider profiles

`Change PIN`, `Privacy Policy`, `Terms of Service` and `Help & Support` were `<button>`s with no
`onClick` on the driver settings screen. The rider account screen had none of the four at all.

| Row              | Now                                                                                                                                                                                                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Change PIN       | Sets or replaces the payout PIN via the existing `POST /{driver\|rider}/wallet/pin`, with `GET .../pin` deciding whether the copy reads "Set" or "Change". Rejects a mismatch, a non-4-digit PIN, four identical digits and a straight sequence, all before any request goes out. |
| Privacy Policy   | `GET /cms/pages/privacy-policy`                                                                                                                                                                                                                                                   |
| Terms of Service | `GET /cms/pages/terms-of-service`                                                                                                                                                                                                                                                 |
| Help & Support   | WhatsApp deep link to the founder-provided support line, plus a real support ticket posting to `POST /driver/support-tickets`                                                                                                                                                     |

Implemented once in `accountPages.tsx` and rendered by both partner apps — two copies of a
privacy screen is two places for the wording to drift.

**Riders cannot raise tickets.** The support-ticket endpoint is driver-only. Rather than show a
rider a form that posts nowhere, the screen says plainly that in-app tickets are not open to
riders yet and points them at WhatsApp. Recorded here as a backend gap.

**⚠️ Change PIN has no old-PIN challenge.** The backend exposes one `POST .../wallet/pin` for
both setting and replacing, with no verification of the current PIN. For a control that
authorises payouts to a bank account, that is a real weakness — anyone with a live session can
silently replace it. Not faked over in the UI; recorded here as needing a backend change
(challenge the old PIN, or re-authenticate) before launch.

#### Legal documents

Privacy Policy and Terms of Service are seeded as **published CMS pages**, not hardcoded in the
bundle, so Ops can revise them without a deploy — a privacy notice nobody can correct in a hurry
is worse than none.

**⚠️ BOTH ARE DRAFTS AND HAVE NOT BEEN REVIEWED BY A LAWYER.** They were written to describe
what the platform actually does — phone-primary identity with no usernames, what location is
collected and when, that drivers never see a customer's phone number, commission, the ₦1,500
minimum fare, surcharge zones, cash and wallet payment, driver verification and inspection —
and each ends with a section stating plainly that it awaits legal review. They must be reviewed
and approved by counsel, and checked against the Nigeria Data Protection Act, before DrippleX
relies on them publicly.

---

### Notification sounds across the platform (DPX-SOUND-001) — logged 2026-08-18

Founder request: _"sounds and alert system for order and delivery, and successful transaction
either booking or order or delivery — a sound for notification should be introduced to the whole
system. Every service or activity that requires attention should come with a sound notification
that can be turned ON and off. Also it can be chosen from different sound list."_

**Where a sound now plays**

| Who       | When                                                        | Event         |
| --------- | ----------------------------------------------------------- | ------------- |
| Driver    | A ride offer arrives                                        | `new-request` |
| Rider     | A delivery job arrives                                      | `new-request` |
| Merchant  | The new-order count rises                                   | `new-request` |
| Passenger | A driver is found for their ride                            | `success`     |
| Customer  | An order is placed and paid (wallet, cash or bank transfer) | `success`     |

Each site guards against repetition, because every one of them is a **poll**, not a push:
the driver keys on the offer id (5s poll, 15s offer life — otherwise one request chimes three
times), the rider keys on a set of seen job ids, the merchant sounds only on a _rise_ in the
count, and the passenger and customer paths already run once by construction.

**Sounds are synthesised, not audio files.** Five deliberately distinguishable tones — Chime,
Ping, Bell, Alert, Drop — generated with the Web Audio API. No binary assets, nothing to fetch
at the moment it needs to play (a driver on a weak connection would otherwise hear the alert
late or not at all), and they work offline. `play()` is the single place to change if the
founder later commissions real audio.

**The preference is device-local, deliberately.** The backend's `NotificationPreference` model
is channel × type — whether to _send_ you something. Which sound a handset makes, and whether
it makes one, is a property of the handset: a driver may want alerts loud on the work phone and
silent on the one at home. So it is localStorage, per device. Making it follow the account
across devices is a backend field and a deliberate decision, not an oversight.

**Sound is ON by default.** A driver who misses a job because the platform chose to start silent
has been failed by the default.

**Autoplay is handled honestly.** Browsers hold audio back until the user has interacted with
the page. `installUnlockListener()` arms the context on the first tap anywhere in the app, long
before a job arrives; until then `play()` is a no-op rather than an error, and the settings
screen says "tap any sound above to enable it" rather than showing a working-looking toggle that
produces silence. A browser with no Web Audio at all is told so plainly.

**Removed:** the driver settings screen's "Sound Alerts" toggle. It flipped local state that was
written and never read, and forgot itself on reload — it changed nothing. The real control
replaces it.

**Not covered yet, and not faked:** sound while the app is in the background or closed. That
needs push notifications with a notification-channel sound on the device, which is a native/PWA
concern (`DeviceRegistry` exists; the push provider wiring does not). Flagged rather than
implied — the current sounds only play while the app is open.

**Verification:** driven in Chromium with `createOscillator` instrumented, since a headless run
cannot hear anything. The control renders on the driver settings screen, the old fake toggle is
gone, all five sounds are listed, selecting one plays it (0 → 2 oscillators for the two-tone
Bell) and persists `{"enabled":true,"sound":"bell"}`, switching off persists `enabled:false`,
hides the list and produces no oscillator, and switching back on persists again.

---

## Utilities tab — four new screens with no Figma source (2026-08-18)

**Founder request:** _"Get ready to build a utility tab activate it and connect it to peyflex
hub."_

**Divergence, stated plainly:** the production Figma has **no Utilities screens**. The
`⚡ Utilities` quick-action tile exists on the customer home screen and has always led nowhere.
Four screens were built without a design source:

| Screen               | Key              | What it does                                        |
| -------------------- | ---------------- | --------------------------------------------------- |
| Utilities home       | `utilities`      | Picks one of the four services; states availability |
| Buy utility          | `utilitybuy`     | Provider → identifier → verify → plan/amount → pay  |
| Receipt              | `utilityreceipt` | Outcome, the delivered token, the reference         |
| Bill payment history | `utilityhistory` | Past purchases; reopens any receipt                 |

They follow the existing partner-account chrome (`accountPages.tsx`) — same navy palette, same
back button, same section labels — rather than inventing a new visual language. **This is
implementation ahead of design, and it should be reconciled against Figma when Utilities screens
are drawn.** Logged here rather than left for someone to discover.

**Three decisions that are product behaviour, not styling:**

- **The tile only goes live when the server says the provider is configured.** `GET
/customer/utilities` returns `available`, and the four service buttons are disabled with a
  plain explanation when it is false. A tab that looks live and fails after the customer has
  chosen a bundle is worse than one that says it is off.
- **Per-disco electricity bounds are shown before payment**, read from the provider (Kaduna
  1,100–100,000; Kano 500–500,000). Without them the customer meets a provider rejection _after_
  their money has moved.
- **The electricity token is re-displayable from history.** It is the thing the customer bought;
  a token shown once and lost with the app is money lost.

**Verification:** driven in Chromium against doubles built from the **backend** controller and
service DTOs (not from the super-app's own interface — that mistake is what shipped the
`RideTypeCatalogEntryDto` mismatch). 21 checks, zero runtime errors: the tile routes; all four
services render; discos come from the server; the ₦1,100–₦100,000 bounds show before paying;
meter verification returns the account name; the purchase POST carries
`{serviceType, provider, customerIdentifier, amount, meterType, paymentMethod}`; the receipt shows
the token and reference; a success sound plays; history speaks plain words ("Delivered", not
`SUCCESSFUL`) and reopening a row shows the token again; both ₦800 and ₦1,505 `M2GBS` bundles list
separately and the composite `M2GBS:1505` id is sent rather than the bare code; and an
unconfigured provider is stated with the services untappable.
