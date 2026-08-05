# DPX-MERCHANT-006 — Onboarding / KYC: Implementation + Integration Verification

Status: **Implemented, live-verified against the real backend. Founder review pending.**

Third Merchant Phase 2 screen, per the founder's locked ordering (Incoming
Orders → Business Profile → **Onboarding/KYC** → Wallet & Bank → Reviews →
Notifications → Analytics). Built as a UI layer over the existing
`MerchantController`/`MerchantsService` KYC endpoints
(`POST/GET /merchant/kyc`) — no backend, SDK, or schema changes needed.

## 1. Scope delivered

One new merchant-portal page, plus nav wiring:

- `apps/merchant-portal/src/app/(dashboard)/kyc/page.tsx` — a status card
  showing the merchant's current verification state, a submission form
  (shown only when submission is actually allowed), and a history card of
  every past submission once more than one exists.
- `sidebar.tsx` / `mobile-nav-drawer.tsx` — added a "Verification" nav
  item.

### What "MerchantOnboarding" turned out to mean (research finding)

`MerchantProfile.onboarding` (`MerchantOnboarding` model, an
`OnboardingStatus` field) exists on the schema and is updated by
`approveMerchant`/`rejectMerchant`/`reactivateMerchant`, but **no
merchant-facing endpoint reads or writes it** — it's grepped once in
`merchants.service.ts` and never surfaced through `merchant.controller.ts`.
It's an internal admin-tracked mirror of the overall approval lifecycle,
not a merchant-facing capability. This screen therefore does not attempt
to show "onboarding status" as its own concept — the overall approval
journey is already shown on the Business Profile readiness card (via
`Business.status`/`verificationStatus`, confirmed in DPX-MERCHANT-005 to
move in lockstep with the real approval lifecycle), and this screen's job
is specifically the KYC document itself: submit it, see its status, see
why it was rejected if it was, resubmit if needed.

### Real KYC lifecycle, read from source (not assumed)

- `POST /merchant/kyc` requires a `Business` to already exist
  (`NotFoundDomainException('Create a business before submitting KYC')`
  otherwise) — the page gates on this exactly: if `GET /merchant/business`
  404s, it shows a "Complete your business profile first" card with a link
  to `/business`, instead of a submission form that would just fail.
- Only one **pending** (`verificationStatus === 'PENDING'`) submission is
  allowed at a time (`findActivePendingKyc` in the repository) — a second
  submission while one is pending is rejected with 409. The page mirrors
  this by only rendering the submit form when there is no submission yet
  or the latest one is `REJECTED` — never while `PENDING` or `VERIFIED`.
- **Resubmission after rejection is real, existing backend capability** —
  once the latest submission is `REJECTED`, it's no longer "active
  pending," so `POST /merchant/kyc` succeeds again and becomes the new
  latest. The founder's instruction to "document honestly instead of
  creating temporary behavior" if resubmission wasn't supported turned out
  not to apply here — it genuinely is supported, confirmed live (§3).
- `KycVerificationStatus` has exactly three real values: `PENDING`,
  `VERIFIED`, `REJECTED`. **There is no distinct "Under Review" state** —
  no reviewer-assignment field, no in-progress sub-status anywhere in the
  schema or service layer. The founder's requirement to distinguish
  Submitted / Under Review / Approved / Rejected could not be met exactly
  as asked, because the backend does not track that distinction. Rather
  than inventing a fourth state, `PENDING` is labelled honestly as one
  combined state: **"Submitted — awaiting review."**
- Rejection remarks (`MerchantKycDto.remarks`) ARE merchant-visible — set
  by `MerchantsService.rejectKyc()` (admin-only, requires ≥3 characters)
  and returned as-is on `GET /merchant/kyc`. Shown verbatim when the
  latest submission is `REJECTED`.

### Document type curation

`SubmitKycDto`'s `documentType` accepts the full shared `KycDocumentType`
enum with no portal-specific restriction at the backend — including
`VEHICLE_REGISTRATION`, `GUARANTOR_ID`, and `INSURANCE`, which only have
meaning for Driver KYC (confirmed against
`apps/backend/src/drivers/dto/submit-identity-verification.dto.ts` and the
Driver module's own KYC usage). The submission form's dropdown only offers
`NATIONAL_ID`, `PASSPORT`, `DRIVER_LICENSE` (as an ID document),
`CAC_CERTIFICATE`, and `BUSINESS_REGISTRATION` — the values that are
actually meaningful for a merchant. This is the same kind of curation
Incoming Orders already did against `OrderStatus` (`ACTIONABLE_STATUSES`)
— narrowing a shared enum's UI surface to what's contextually valid, not
inventing a new verification step.

### Document images

There is no file-upload endpoint anywhere in the backend
(`SubmitKycDto`'s `frontImage`/`backImage`/`selfieImage` are all
`@IsUrl`). This matches the exact convention Products' image management
already uses (`ProductImagesPanel` in `products/[id]/page.tsx` — paste an
already-hosted URL). The KYC form follows the same pattern rather than
inventing a camera-capture flow — Driver's identity verification module
does have a real base64/camera flow, but that's a distinct, dedicated
Smile ID integration with no equivalent wired for Merchant KYC; nothing to
build around here, just documented for accuracy.

## 2. Founder requirements — how each was met

- **Use only the existing backend onboarding/KYC capability.** Confirmed
  live: `POST/GET /merchant/kyc` fully cover submit/status/history. No
  backend or SDK changes.
- **Do not invent verification steps.** No fourth "Under Review" state
  invented; `PENDING` labelled as a single honest state instead.
- **Show the merchant exactly where they are in the approval journey.**
  `StatusCard` renders the real `latest.verificationStatus`,
  `latest.documentType`, submission/review timestamps, and — when
  rejected — the real rejection remarks.
- **Distinguish Submitted / Under Review / Approved / Rejected.** Met as
  far as the real backend data allows — see the "Under Review" finding
  above; documented honestly rather than faked.
- **Surface document status using the real backend.** `HistoryCard` shows
  every past submission (`items`) with its own real status, once more
  than one exists.
- **If additional documents are genuinely supported, expose them.**
  `backImage`/`selfieImage` (both optional per `SubmitKycDto`) are exposed
  as optional fields in the form.
- **If resubmission isn't genuinely supported, document that honestly.**
  It IS genuinely supported — confirmed live — so the form is enabled
  after a rejection rather than blocked or faked.
- **Do not modify the activation gate.** No `MerchantsService` code
  touched. The gate (Business + latest-KYC-VERIFIED → admin approval,
  audited in `DPX-MERCHANT-001-REALITY-AUDIT.md` §9) is unchanged; this
  screen only lets the merchant see and act on their own KYC state.

## 3. Live integration verification (real backend, real Postgres, real HTTP)

`tsc --noEmit`, `eslint --max-warnings=0`, and `next build` all pass clean
(10 routes, including the new `/kyc`).

A live E2E script drove the exact HTTP contract this page calls:

1. Real merchant user, no `Business` yet, logged in via the real
   `POST /auth/login/merchant`.
2. `POST /merchant/kyc` before a business exists → **404** `"Create a
business before submitting KYC"` — confirms the page's business-first
   gate matches real backend enforcement exactly.
3. `GET /merchant/kyc` with nothing submitted → **200**,
   `{latest: null, items: []}` — confirms the "no submission yet" state.
4. Created the prerequisite business, then `POST /merchant/kyc` → **201**,
   `verificationStatus: PENDING` — confirms the submission path.
5. `GET /merchant/kyc` → **200**, `latest` is the just-submitted document
   — confirms `StatusCard`'s data source.
6. A second `POST /merchant/kyc` while the first is still `PENDING` →
   **409** `"An active KYC submission is already pending review"` —
   confirms the submit-form-hidden-while-pending logic matches real
   backend enforcement, not just UI convenience.
7. Simulated the real admin `rejectKyc()` DB effect (status → `REJECTED`,
   `remarks` set) → re-fetched → **200**, `remarks` genuinely visible on
   the merchant-facing DTO — confirms rejection reasons are real, not
   assumed.
8. `POST /merchant/kyc` again (resubmission) → **201**, succeeds and
   starts a new `PENDING` cycle — confirms resubmission after rejection is
   real backend behavior, addressing the founder's explicit "if the
   backend lacks resubmission, document that honestly" instruction by
   confirming the opposite is true.
9. `GET /merchant/kyc` → `items.length === 2` — confirms `HistoryCard`
   would show both the rejected and the new pending submission.
10. Simulated admin approval of the second submission → re-fetched →
    **200**, `latest.verificationStatus: VERIFIED` — confirms the
    "Approved" state and that no submit form would render once approved.

All 12 checks passed (steps above plus the initial user/business setup
assertions). Fixture data was created and cleaned up in the same run.

## 4. What this verification does not cover

- No Playwright/browser click-through — same scope note as prior Phase 2
  screens; deferred to the module-level Phase 2 E2E pass (task #389).
- Document-image URLs are not validated for reachability by this page or
  the backend beyond `@IsUrl` shape validation — consistent with how
  Products' image URLs are handled, not a KYC-specific gap.

## 5. Files changed

- `apps/merchant-portal/src/app/(dashboard)/kyc/page.tsx` (new)
- `apps/merchant-portal/src/components/layout/sidebar.tsx`
- `apps/merchant-portal/src/components/layout/mobile-nav-drawer.tsx`

No backend, SDK, schema, or shared-types changes.

## 6. Next step

Per the founder's locked ordering: **Wallet & Bank** is next in Phase 2 —
which per the founder's standing instruction must include transparent
settlement detail (gross subtotal, commission rate, commission amount, net
merchant amount, settlement status, order reference) once built, not just
a wallet balance.
