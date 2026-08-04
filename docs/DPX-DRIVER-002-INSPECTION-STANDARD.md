# DPX-DRIVER-002 — Driver & Vehicle Inspection Standard

**Status: Design — Approved & Founder-Locked (2026-08-04), not yet implemented.**
Written before implementation, per the same "design note before code" discipline
as `DRIVER-001-IDENTITY-VERIFICATION-DESIGN.md` and every other `*-DESIGN.md` in
this repo — locks the founder's requirements into concrete decisions, and is
honest about what's genuinely new work versus what already exists, before any
schema or service code gets written.

Complements `docs/DPX-DRIVER-001-SECURITY-STANDARD.md`: DPX-DRIVER-001 governs
an _already-onboarded_ driver's ongoing identity/session security (risk-based
re-verification, device trust, lockout). DPX-DRIVER-002 governs the _gate a
driver and their vehicle must pass to be onboarded in the first place_ —
physical inspection, not just digital KYC. Once a driver is `ACTIVE` under this
standard, DPX-DRIVER-001 takes over for every subsequent go-online decision.

## Why physical inspection, not digital-only KYC

The founder's explicit rationale, recorded here because it's a real product
decision with cost and operational implications, not an obvious default: in
the Nigerian market specifically, digital KYC alone (document upload +
liveness selfie) doesn't verify that a _vehicle_ is roadworthy or that a
driver's in-person appearance/behavior matches what a passenger should expect.
A mandatory physical inspection step — at a DrippleX Inspection Centre or
approved partner — closes that gap: it catches fake accounts, unsafe
vehicles, and document fraud that liveness detection alone cannot.

## The four phases

### Phase 1 — Online application

Status: **`Application Received`**

Driver submits, through the (not-yet-built) structured onboarding flow:

| Item                       | Backend reality today                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personal details           | `DriverProfile`/`User` — real.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| NIN/BVN                    | **Not built, provider-blocked** — same class of decision as DRIVER-001's facial-verification provider choice. No BVN/NIN concept exists anywhere in the schema today (checked, not assumed — see `docs/DPX-DRIVER-001-SECURITY-STANDARD.md` §7's decision log for the earlier version of this same finding). Smile ID does offer NIN/BVN lookup products in Nigeria; wiring it is a real, scoped follow-up once this document is approved, not silently invented here. |
| Driver's licence           | `DriverKyc` with `documentType: DRIVER_LICENSE` — real, exists today.                                                                                                                                                                                                                                                                                                                                                                                                  |
| Vehicle papers             | `DriverKyc` with `documentType: VEHICLE_REGISTRATION` — real, but only as an uploaded document, not structured `Vehicle` data (plate, make, model, color, year) a driver or admin can query/edit. Closing this gap is Phase 1 of the existing Driver App slice plan (`docs/DRIVER-APP-DPX-100-AUDIT.md`), which this standard folds in as a prerequisite rather than a parallel effort.                                                                                |
| Vehicle insurance          | **Not built.** No `INSURANCE` value in the `KycDocumentType` enum, no expiry-tracking field anywhere. New enum value + expiry date field, straightforward.                                                                                                                                                                                                                                                                                                             |
| Profile photo              | `User`/`DriverProfile` — real (used for the driver-facing profile display).                                                                                                                                                                                                                                                                                                                                                                                            |
| Selfie/liveness (Smile ID) | Real — `DriverIdentityVerificationService`/`SmileIdProvider`, per DPX-DRIVER-001 §2, `trigger: ONBOARDING`.                                                                                                                                                                                                                                                                                                                                                            |
| Bank account               | Real — driver wallet/bank-account linkage already exists (`docs/RIDE-002.7...` wallet work), reused here, not rebuilt.                                                                                                                                                                                                                                                                                                                                                 |
| Emergency contact          | **Not built.** No field anywhere on `DriverProfile`. New optional field(s), straightforward.                                                                                                                                                                                                                                                                                                                                                                           |

### Phase 2 — Background verification

Status: **`Pending Inspection`**

| Check                         | Backend reality today                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity                      | Real — Smile ID `ONBOARDING` verification from Phase 1.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Driver's licence validity     | **Not built** — `DriverKyc` records a licence document exists and an admin can manually mark it `VERIFIED`/`REJECTED`, but there's no automated licence-authority lookup. Nigeria has no universal public API for this; stays admin-reviewed unless/until a specific data provider is chosen — a provider decision, same class as Smile ID/BVN-NIN, not something to fake as "automatically verified."                                                                                 |
| Vehicle registration validity | Same as above — admin-reviewed against the uploaded document, not automated, until a provider decision is made.                                                                                                                                                                                                                                                                                                                                                                        |
| Insurance validity            | Same — admin-reviewed against the uploaded document plus the expiry date field from Phase 1.                                                                                                                                                                                                                                                                                                                                                                                           |
| Criminal/watchlist checks     | **Not built, no provider integrated, genuinely infeasible today.** No background-check API exists anywhere in this codebase. This is not a small gap to close alongside the others — it needs its own provider decision (a real background-check vendor, likely with its own compliance/data-residency implications, the same weight as the Smile ID decision was) before any code gets written. Documented here as an explicit, real gap, not silently skipped or faked as "checked." |

### Phase 3 — Physical inspection (mandatory)

Status: **`Inspection Passed`** or **`Inspection Failed`**

This is the phase with the most genuinely new backend work — nothing here
exists today:

- **`InspectionCentre` model** — name, address, geolocation, active/inactive,
  which cities/zones it serves. New.
- **`Inspection` model** — links a driver + vehicle + centre + inspector,
  scheduled appointment time, result (`PASSED`/`FAILED`), a structured
  checklist result (see below), free-text inspector notes, and photo
  attachments (multiple angles, stored the same way `DriverKyc` stores
  document images today).
- **Appointment booking** — a driver picks a centre and a time slot. New
  scheduling logic; no existing "book an appointment" concept anywhere in
  this platform to reuse (Ride's dispatch is a different problem — real-time
  matching, not calendar slots).
- **Inspector role** — a new user role (`inspector`, alongside the existing
  `customer`/`merchant`/`rider`/`driver`/`operations_staff`/`administrator`/
  `super_administrator`), scoped to: viewing their assigned appointments,
  recording a checklist result, uploading photos, and nothing else. Whether
  this needs its own portal (an `inspector-app`, mirroring `driver-portal`'s
  existing pattern) or can be folded into `operations-console` is a real
  product decision, not assumed here — flagged for the founder, not silently
  decided.
- **Structured checklist**, driver side: physical identity match, facial
  verification (re-run or cross-check against the Phase 1 Smile ID result —
  a design decision for the implementation pass, not assumed here),
  original licence presented, professional appearance, optional basic
  driving assessment. Vehicle side: exterior condition, interior
  cleanliness, A/C, seat belts, brakes, tires, lights, horn, mirrors,
  windshield, engine, suspension, fire extinguisher, first aid kit, spare
  tire, jack & wheel spanner, branding (if applicable) — each a pass/fail
  item with an optional note, not free-text-only (structured data is what
  makes "which check fails most often" reportable later).
- **Photos** — multiple angles per inspection, stored and linked to the
  `Inspection` record, same storage pattern as existing KYC document images.

### Phase 4 — Driver activation

Status: **`Active`**

Gate: identity verified (Phase 1) **and** documents approved (Phase 2) **and**
physical inspection passed (Phase 3) **and** driver agreement signed. Only
then does `DriverProfile.status` become the platform's existing `APPROVED`
status (or a new explicit status if `APPROVED` already carries different
semantics elsewhere — a real check against current `DriverStatus` enum usage
before reusing or extending it, not assumed here) and the driver can go
online — at which point DPX-DRIVER-001's risk engine takes over.

**Driver agreement signed** — not built. No e-signature/agreement-acceptance
concept exists anywhere in this platform for any user type. New: an
`agreementVersion`/`agreementAcceptedAt` field is the minimal real
implementation (a full e-signature product like DocuSign is out of scope
unless the founder wants it — flagged, not assumed).

## Periodic re-inspection

Trigger conditions, all requiring new scheduling/tracking logic (none exist
today):

- Every 6-12 months (configurable — per DPX-901, this is exactly the kind of
  value that belongs in `DriverSecuritySettings` or a sibling
  `DriverInspectionSettings` admin-configurable row, not a hard-coded
  constant).
- After a major accident — requires an "accident reported" signal somewhere
  in the platform to trigger from; none exists today (Ride has no
  accident/incident-report concept). New.
- After repeated safety complaints — same gap: no "safety complaint"
  concept distinct from the existing ride-problem-report flow
  (`docs/RIDE-002.8...`); whether to reuse that or build a distinct
  "safety complaint" category is a real design decision for the
  implementation pass.
- Vehicle changed — requires the `Vehicle` model (Phase 1 gap above) to
  exist first, since "changed" implies there's a structured prior vehicle
  record to compare against.
- Inspector/admin-requested — straightforward once `Inspection` exists;
  an admin or inspector flags `DriverProfile` for re-inspection, same
  pattern as DPX-DRIVER-001's `MANUAL_ADMIN` trigger.

## What this standard deliberately does not claim

Matching the same discipline as DPX-DRIVER-001 §7's decision log — real gaps,
named honestly, not silently invented or skipped:

- **No automated document-authenticity verification** (licence, vehicle
  registration, insurance) exists or is assumed here. Everything in Phase 2
  beyond identity is admin-reviewed against an uploaded document until a
  specific data-provider decision is made.
- **No criminal/watchlist-check provider** is chosen or assumed. This is the
  single largest open item in this standard — flagged for an explicit
  founder decision before any related code is written, the same way the
  facial-verification provider decision was made before DPX-DRIVER-001's
  implementation began.
- **No inspector portal/app is scoped or built.** Whether inspectors get
  their own app or use `operations-console` is an open question for the
  implementation pass, not decided by this document.
- **No NIN/BVN provider integration** exists yet; Smile ID's Nigeria-specific
  products are the likely candidate given it's already the chosen identity
  provider, but that's a recommendation here, not a decision already made.

## Relationship to the existing Driver App slice plan

This standard supersedes and absorbs what `docs/DRIVER-APP-DPX-100-AUDIT.md`
called "Slice 1 — Vehicle management + structured onboarding": that slice's
`Vehicle` model and structured multi-step onboarding flow are Phase 1/3
prerequisites here, not a separate parallel effort. See that document's
updated slice plan for how this fits into the founder's reordered Driver
module priority (onboarding & KYC first, then vehicle management, then the
remaining priority items).
