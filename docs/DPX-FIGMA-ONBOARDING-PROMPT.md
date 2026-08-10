# DPX — Figma Prompt: Merchant / Driver / Rider Self-Onboarding

**Purpose:** one comprehensive, credit-efficient Figma Make prompt for the partner
onboarding screens the Super App is missing. Founder-authorized 2026-08-10 ("give it to
Figma to design"). Paste the **Prompt to run in Figma** section into Figma Make. Everything
is grounded in the **real backend contract** (verified 2026-08-10) so the output wires with
no invented fields. After Figma returns, Claude wires each screen to the endpoints listed.

> Design language: match the existing DrippleX Super App — the same dark navy gradient,
> rounded cards, green accent (`#2BAC52`), Poppins headings / Inter body, 54px inputs,
> pill buttons — that the customer `RegisterScreen` / `OTPScreen` already use. These new
> screens sit in the SAME app, not a separate portal.

---

## Context the design must respect (backend truth)

- **One identity, multi-role.** DrippleX is a single-account Super App (like Uber/Grab):
  one login, roles surfaced in the app. A person signs up as a partner from the consumer
  app — there is **no separate portal app**.
- **Email-first onboarding (temporary).** SMS (Termii) sender-ID approval is pending, so
  **all partner sign-ups verify by EMAIL code** for now (the same 6-digit OTP screen the
  customer uses, calling `POST /auth/verify/email`). Keep a phone field where the backend
  requires it (driver/rider), but verification is by email.
- **No username. No KYC for customers.** Identity = name + email (+ phone). Partners
  (merchant/driver) submit documents; customers never do.
- **Approval is real for merchant & driver, pending for rider.** After sign-up + email
  verification the account is ACTIVE but the partner **cannot operate until approved**.
  The approver side is handled off-app (Operations/Admin). These screens only need a
  truthful **"pending review"** state.

---

## Screens to design (7 new + reuse the existing OTP screen)

### A. Partner role picker — "Join DrippleX as a partner"

One entry screen reached from the consumer side (e.g. a "Become a partner" row in the
account drawer, or a link on Welcome). Three large choice cards:

- **Sell on DrippleX** (Merchant) — "List your store and receive orders."
- **Drive & earn** (Driver) — "Accept ride requests in your car."
- **Deliver & earn** (Rider) — "Pick up and deliver orders."
  Each card → the matching sign-up screen below.

### B. Merchant sign-up

Fields (all map to `POST /auth/register/merchant`, `PortalRegistrationDto`):

- Full Name (required) → split to firstName/lastName
- Email (required — the verification channel)
- Password (required; **min 8, with an uppercase letter and a number** — show this rule)
- Business Name (required) _(used right after, for `POST /merchant/business`)_
- Business Type (select) _(for the business profile)_
  Primary button "Create merchant account" → **email OTP screen** (reuse existing) →
  **Merchant pending-approval screen (F)**.

### C. Driver sign-up

Fields (map to `POST /auth/register/driver`, `RiderDriverRegistrationDto`):

- Full Name (required)
- Email (required — verification channel)
- Phone Number (required by backend; kept on file, **not** the verification channel now)
- Password (required; min 8 + uppercase + number)
  Primary button "Apply to drive" → email OTP screen → **Driver document upload (E)**.

### D. Rider sign-up

Same field set as Driver (`POST /auth/register/rider`): Full Name, Email, Phone
(required), Password. Button "Apply to deliver" → email OTP screen → **Rider
pending-approval screen (F, rider variant)**.

### E. Driver document upload

A checklist of the documents the backend actually requires for driver activation
(`POST /driver/kyc`, `documentType` enum + `documentNumber` + a document photo):

- **Driver's License** (`DRIVER_LICENSE`)
- **Vehicle Registration** (`VEHICLE_REGISTRATION`)
- **Guarantor ID** (`GUARANTOR_ID`)
  Plus a **Vehicle details** mini-form (make, model, plate, colour, ride category:
  Economy / Comfort / XL / Tricycle, seats) → `POST /driver/vehicles`. Each row: a
  capture/upload control + a "document number" field + a per-document status pill
  (Pending / Verified / Rejected). A primary "Submit for review" → **Driver pending-approval
  screen (F, driver variant)** that shows the **six activation checks**: Identity, Documents,
  Vehicle, Inspection, Agreement, Account standing.

### F. Pending-approval screen (three variants: merchant / driver / rider)

A calm "You're all set — we're reviewing your application" state:

- Big status badge "Under review", friendly copy: "Your application is with the DrippleX
  team. We'll notify you as soon as you're approved."
- Merchant variant: a short "what happens next" list (business verified → KYC verified →
  approved).
- Driver variant: the six-check activation list with per-check state.
- Rider variant: a simple submitted/under-review state.
- A "Refresh status" action and a link back to the consumer Home (they can still shop/ride
  as a customer while they wait).

---

## Prompt to run in Figma

> Design a set of partner-onboarding mobile screens for the DrippleX Super App, matching
> the app's existing style exactly: dark navy vertical gradient background, rounded 24px
> cards on a slightly lighter navy surface, green accent #2BAC52, Poppins for headings and
> Inter for body, 54px-tall rounded input fields with a subtle border that turns green on
> focus, and a full-width green pill primary button with a right arrow. Reuse the existing
> 6-digit OTP verification screen style.
>
> Screens:
>
> 1. "Join DrippleX as a partner" — three tappable choice cards: Sell on DrippleX
>    (merchant), Drive & earn (driver), Deliver & earn (rider), each with an icon, title
>    and one line of copy.
> 2. Merchant sign-up — inputs: Full Name, Email, Password (helper text "at least 8
>    characters, with an uppercase letter and a number"), Business Name, Business Type
>    (dropdown). Primary button "Create merchant account". A "Already a partner? Sign in"
>    link.
> 3. Driver sign-up — inputs: Full Name, Email, Phone Number, Password (same helper).
>    Primary button "Apply to drive".
> 4. Rider sign-up — inputs: Full Name, Email, Phone Number, Password. Primary button
>    "Apply to deliver".
> 5. Driver documents — a checklist of three document cards (Driver's License, Vehicle
>    Registration, Guarantor ID), each with an upload/capture control, a "document number"
>    field, and a status pill (Pending / Verified / Rejected); below it a Vehicle details
>    form (Make, Model, Plate number, Colour, Ride category dropdown [Economy, Comfort, XL,
>    Tricycle], Seats). Primary button "Submit for review".
> 6. Pending review — a centered "Under review" badge, reassuring copy "Your application is
>    with the DrippleX team — we'll notify you the moment you're approved", a vertical
>    checklist of review steps with pending/done states, a "Refresh status" secondary
>    button, and a "Back to Home" text link. Provide three variants: merchant (business →
>    KYC → approved), driver (Identity, Documents, Vehicle, Inspection, Agreement, Account
>    standing), and rider (Submitted → Under review).
>
> Keep the verification step as the existing OTP screen (do not redesign it). Do not add a
> username field anywhere. Mobile frame, one flow per persona.

---

## Wiring map (after Figma returns — Claude fills this in)

| Screen                    | Endpoint(s)                                                                                                                    | Notes                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Merchant sign-up          | `POST /auth/register/merchant` → OTP `POST /auth/verify/email` → login `POST /auth/login/merchant` → `POST /merchant/business` | email code; business created post-verify                                                 |
| Driver sign-up            | `POST /auth/register/driver` → `POST /auth/verify/email` → `POST /auth/login/driver`                                           | phone stored, email verified                                                             |
| Rider sign-up             | `POST /auth/register/rider` → `POST /auth/verify/email` → `POST /auth/login/rider`                                             | rider approval backend still pending (Piece C)                                           |
| Driver documents          | `POST /driver/kyc` (per doc), `POST /driver/vehicles`, `POST /driver/onboarding/agreement`                                     | **doc image = a hosted URL**; no file-upload/storage backend yet (documented dependency) |
| Pending review (merchant) | `GET /merchant/business` / `GET /merchant/kyc` for status                                                                      | approval done in Admin/Ops                                                               |
| Pending review (driver)   | `GET /driver/activation-eligibility` (the six checks)                                                                          | approval done in Admin/Ops                                                               |
| Pending review (rider)    | —                                                                                                                              | **no rider status endpoint yet** — Piece C builds it                                     |

### Dependencies to flag to the founder (not faked)

- **File upload/storage**: the KYC endpoints accept image **URLs** only; there is no
  upload service yet. The document-capture control is visual until that exists.
- **Driver identity verification**: currently Smile ID; a separate task is replacing it with
  DrippleX-native device biometric IDV — keep the "Identity" check generic in the UI.
- **Rider approval**: the backend has a rider `isApproved` field but **no approve/reject
  endpoints** — being built in the Ops-Console effort (Piece C). The rider pending screen is
  design-ahead-of-backend until then.
- **PORTAL_EMAIL_ACTIVATION** (backend PR #95) must be merged + enabled for merchant/driver/
  rider email onboarding to actually activate accounts.
