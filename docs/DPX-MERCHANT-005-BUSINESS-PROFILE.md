# DPX-MERCHANT-005 — Business Profile: Implementation + Integration Verification

Status: **Implemented, live-verified against the real backend. Founder review pending.**

Second Merchant Phase 2 screen, per the founder's locked ordering (Incoming
Orders → **Business Profile** → Onboarding/KYC → Wallet & Bank → Reviews →
Notifications → Analytics). Built entirely as a UI layer over the existing
`MerchantController`/`MerchantsService` business endpoints
(`apps/backend/src/merchants/`) — no backend, SDK, or schema changes were
needed; full CRUD already existed from an earlier phase (confirmed by
reading `merchant.controller.ts`/`merchants.service.ts`/`merchant-api.ts`
directly, not assumed).

## 1. Scope delivered

One new merchant-portal page, plus nav wiring:

- `apps/merchant-portal/src/app/(dashboard)/business/page.tsx` — shows a
  **readiness card** (Business details → Verification → Approval → Add
  products → Start selling, matching the sequence the founder required be
  presented honestly per §12 of `DPX-MERCHANT-001-REALITY-AUDIT.md`) and a
  **business details form** that switches between create mode (no
  `Business` row yet) and edit mode (one exists), calling
  `sdk.merchant.createBusiness`/`getBusiness`/`updateBusiness` — all
  Phase-1-era SDK methods, unchanged.
- `sidebar.tsx` / `mobile-nav-drawer.tsx` — added a "Business" nav item.

### Readiness card logic (real state only)

The five steps' `done`/`current` flags are computed directly from
`BusinessDto.status` and `BusinessDto.verificationStatus` — the same two
fields `MerchantsService.approveMerchant()` sets in lockstep with
`MerchantProfile.status` (confirmed by reading `approveMerchant`/
`rejectMerchant`/`suspendMerchant`/`reactivateMerchant`: every one of them
updates `Business.status`/`verificationStatus` in the same transaction as
the underlying `MerchantProfile.status` change). There is no merchant-
facing endpoint that returns `MerchantProfile.status` directly (that DTO,
`MerchantProfileDto`, is admin-only — used only by
`admin-merchants.controller.ts`), so `Business.status ===
'ACTIVE'`/`'PAUSED'` is used as the honest, verified-correct proxy for
"this merchant is approved," not fabricated:

| Business state                                               | Step 1 (details)  | Step 2 (verification) | Step 3 (approval) |
| ------------------------------------------------------------ | ----------------- | --------------------- | ----------------- |
| no business row                                              | not done, current | —                     | —                 |
| `SUBMITTED` / `UNDER_REVIEW`                                 | done              | current               | —                 |
| `verificationStatus === VERIFIED`, `status` not yet `ACTIVE` | done              | done                  | current           |
| `status === 'ACTIVE'` or `'PAUSED'`                          | done              | done                  | done              |

If `Business.rejectedReason` is set (populated by `rejectMerchant`), it is
shown verbatim. Bank setup is explicitly captioned as **not** an activation
requirement — "Bank details for receiving payouts can be added separately
under Wallet & Bank — they are not required to get approved or start
selling" — matching the founder's explicit instruction not to imply bank
setup gates activation.

### Form behavior

- No `Business` row (`GET /merchant/business` → 404): renders a create
  form; submit calls `POST /merchant/business`.
- `Business` row exists: renders the same fields pre-filled; submit calls
  `PATCH /merchant/business` with only changed/present fields (partial
  update, matching `UpdateBusinessDto`'s all-optional shape).
- `status === 'SUSPENDED'`: the form is disabled end-to-end (every field
  and the submit button) with an explicit banner, since
  `MerchantsService.updateBusiness` itself throws `ForbiddenDomainException`
  for a suspended business — the UI mirrors a real backend constraint, not
  an invented one.
- Fields mirror `CreateBusinessDto`/`UpdateBusinessDto` exactly: business
  name/type, registration number, tax number (optional), description
  (optional), email, phone, country/state/city/address, latitude/
  longitude, logo/cover photo URLs (optional).

## 2. Founder requirements — how each was met

- **Use existing backend capability wherever possible.** Zero backend/SDK
  changes. Confirmed live that `POST/GET/PATCH /merchant/business` already
  cover create/read/update completely.
- **Document gaps honestly instead of building around them.** Two real,
  minor gaps found and documented (not worked around):
  1. `Business.operatingHours` exists on the schema and is exposed to
     **customers** (`customer-merchant.mapper.ts`'s `isOpenNow`/
     `operatingHours` on the browse/mini-store DTOs) but has no field on
     `BusinessDto` or `CreateBusinessDto`/`UpdateBusinessDto` — a merchant
     cannot set their own store hours anywhere in the current backend.
     This page does not claim to manage hours; there's simply no "Hours"
     section, rather than a broken or fake one.
  2. `Business` has no `suspensionReason`-equivalent field — when a
     business is `SUSPENDED`, the actual reason (stored on
     `MerchantProfile.rejectedReason`, reused for both rejection and
     suspension reasons per `suspendMerchant()`) is not exposed through
     any merchant-facing endpoint. The suspended-state banner therefore
     says the business is suspended and to contact support, without
     fabricating a reason.
     Neither gap blocks this screen or is large enough to warrant its own
     future-enhancement doc the way the order-fulfilment-details gap did;
     recorded here for visibility instead.
- **No modification of frozen modules.** Only `apps/merchant-portal/**`
  touched.
- **DDS/shared-component composition.** Built from `@dripplex/ui`'s
  `Badge, Button, Card*, Input, Label, LoadingSpinner, Select, Textarea` —
  same set Incoming Orders used, no new primitives.
- **Loading/empty/error states.** Spinner while loading; 404 on first load
  is treated as the legitimate "create your business" state, not an error;
  a real error banner for anything else (network/validation/permission
  failures via `describeSdkError`).
- **Duplicate-submission prevention.** A `saving` flag disables the submit
  button (and the guard is checked before doing any work), matching the
  pattern already used in `products/[id]/page.tsx`'s save forms.

## 3. Live integration verification (real backend, real Postgres, real HTTP)

`tsc --noEmit`, `eslint --max-warnings=0`, and `next build` all pass clean
(9 routes, including the new `/business`).

A live E2E script drove the exact HTTP contract this page calls, against
the real NestJS server and real Postgres — not mocked:

1. Created a real merchant user (`ACTIVE`, email+phone verified, `merchant`
   role) with no `Business` row yet, logged in through the real `POST
/api/v1/auth/login/merchant`.
2. `GET /merchant/business` → **404** before any business exists — confirms
   the create-form code path (`described.statusCode === 404` → render
   create form, not an error) matches real backend behavior exactly.
3. `POST /merchant/business` with a full real payload → **201**, and
   confirmed the real (not assumed) starting state is `status: SUBMITTED`,
   `verificationStatus: UNDER_REVIEW` — corrected an initial wrong
   assumption (`DRAFT`/`PENDING`) against the actual `MerchantsService`
   source before finalizing this doc.
4. `GET /merchant/business` → **200**, returns the same business — confirms
   the page's post-creation reload path.
5. `PATCH /merchant/business` with a partial payload (`description`,
   `city` only) → **200**, only those two fields changed, everything else
   (e.g. `businessName`) untouched — confirms partial-update semantics.
6. Simulated the real admin-approval DB effect (the same fields
   `MerchantsService.approveMerchant()` sets) → re-fetched
   `GET /merchant/business` → **200**, `status: ACTIVE`,
   `verificationStatus: VERIFIED` — confirms the readiness card's
   "Approval" step reads genuine post-approval state, not a guess.
7. Duplicate `POST /merchant/business` on an already-`ACTIVE` business →
   **409** `"Merchant already has an active business"` — confirms the
   backend, not just the UI, enforces one business per merchant.

All 7 checks passed. Fixture data was created and cleaned up in the same
run.

## 4. What this verification does not cover

- No Playwright/browser click-through — same scope note as
  `DPX-MERCHANT-003-INCOMING-ORDERS.md` §6; deferred to the module-level
  Phase 2 E2E pass (task #389).
- The suspended-business disabled-form state was verified by reading
  `MerchantsService.updateBusiness`'s `ForbiddenDomainException` guard
  directly, not separately exercised live in this pass (would require a
  fifth fixture-merchant lifecycle transition beyond what this script
  already covers).

## 5. Files changed

- `apps/merchant-portal/src/app/(dashboard)/business/page.tsx` (new)
- `apps/merchant-portal/src/components/layout/sidebar.tsx`
- `apps/merchant-portal/src/components/layout/mobile-nav-drawer.tsx`

No backend, SDK, schema, or shared-types changes.

## 6. Next step

Per the founder's locked ordering: **Onboarding/KYC** is next in Phase 2.
