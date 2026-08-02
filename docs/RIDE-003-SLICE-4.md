# RIDE-003 — Slice 4: Post Ride

The founder's brief for this slice named 10 screens: Ride History, Saved
Places, Scheduled Ride, Referral, Promo Code, Ride Settings, Ride Support,
Ride Help, Emergency, Ride Preferences. Per the standing rule — "adapt the
UI to the backend, not the backend to the UI; document capability gaps
honestly rather than faking data or workarounds" — a real backend-capability
audit was run against all 10 before writing any screen (methodology:
`grep`/read of every relevant controller, DTO, and type across
`apps/backend/src/` and `packages/types/src/`, not assumption). Result: only
2 of the 10 have real, wired backend capability. Those 2 are built below.
The other 8 are not built as functional screens — each would either require
inventing new backend business logic/schema (forbidden by the founder's own
freeze rule) or fabricating data with nothing behind it. They're documented
as open capability gaps instead.

## Implemented screens

**`RideHistoryScreen`** — real source (Part 1), ported and adapted.

**`SavedPlacesScreen`** — real source (Part 3), ported and extended with a
generated add/edit form (`PlaceForm`, see
`docs/RIDE-003-GENERATED-SCREENS.md`) since the received mock's `onAdd` had
no destination screen and no edit form existed either.

Both are wired into `RideFlow` and reachable from `RideHomeScreen`: a real
clock-icon "History" button (present in the real source next to
`SafetyChip`, not previously wired) and a new "Manage" link next to the
SAVED PLACES section header (a small text-link composition, same pattern
already used by `TipDriverScreen`'s "Skip" and `ReportTripScreen`'s
category list — no new visual element).

## Backend APIs consumed

- `GET /customer/rides` (`listOwnRides`, paginated, `status` filter) —
  `RideHistoryScreen`'s three tabs (all/completed/cancelled) map directly to
  the real `status` query param; "cancelled" filters `status=CANCELLED`
  specifically (not `NO_DRIVERS_FOUND`, a distinct real status the mock's
  two-tab model doesn't have a slot for — it only ever shows under "all").
  Real pagination (`page`/`limit`/`meta.totalPages`) via Previous/Next
  controls, not a fabricated infinite scroll.
- `GET /customer/rides/:id/receipt` — reused for history detail. The
  receipt endpoint 404s for any ride not `COMPLETED`
  (`ride-receipt.service.ts` guards on `status === COMPLETED`), so only
  completed rows in history are tappable; cancelled/other rows render as
  static (non-button) cards instead of linking to a detail view that would
  fail.
- `GET /customer/addresses`, `POST /customer/addresses`,
  `PATCH /customer/addresses/:id`, `DELETE /customer/addresses/:id`,
  `PATCH /customer/addresses/:id/default` — full real CRUD + set-default,
  already existed pre-Ride (customer address book), just not previously
  exposed with a management UI. Added the one missing piece:
  `useSetDefaultSavedPlace` hook (`use-saved-places.ts`), wired to the
  already-existing `sdk.addresses.setDefault()` SDK method — no new SDK
  surface, no new backend endpoint.

No backend or SDK changes this slice — every capability used already
existed.

## Capability gaps (not built as functional screens)

Evidence gathered via a full read-through of `apps/backend/src/rides/`,
`apps/backend/src/promotions/`, `apps/backend/src/notification-center/`,
`packages/types/src/ride/index.ts`, and repo-wide greps for each concept.

1. **Scheduled Ride** — `RequestRideRequest`/`RequestRideDto` have no
   `scheduledAt`/`scheduledFor` field, and `rides.service.ts` has no
   future-dated request logic. The real Figma Make source has a
   `ScheduleRideScreen` (Part 3), but building it functionally would mean
   inventing a scheduling field and a background dispatch mechanism that
   doesn't exist — new business logic, which the backend freeze forbids
   without the founder treating it as a genuine feature request. Not built.

2. **Referral** — grep for "referral" (case-insensitive) across
   `apps/backend/src/` and `packages/types/src/` returns zero real matches
   (only this doc and the Figma reference file mention the word). No
   referral module, endpoint, or field exists anywhere. The real source has
   a `ReferralScreen` (Part 3) with a referral code and reward copy — all of
   it would be fabricated. Not built.

3. **Promo Code** — a real `promotions` module exists
   (`apps/backend/src/promotions/customer-promotions.controller.ts`:
   `GET /customer/promotions/active`, `POST /customer/promotions/validate`,
   `POST /customer/promotions/redeem`), but it's scoped to order/cart
   `subtotal` + `merchantId` — nothing in `RequestRideRequest`,
   `EstimateRideFareRequest`, or `RideFareService` accepts a coupon code or
   applies a discount to ride fare. Wiring the real source's
   `PromoCodeScreen` (Part 3) to this module would mean applying an
   order-discount API to a ride price it was never built to touch —
   exactly the kind of "make the backend do something it doesn't" the
   founder's rules forbid. Not built.

4. **Ride Settings / Ride Preferences** — no customer profile/settings
   module exists at all (`apps/backend/src/customers/` doesn't exist as a
   directory). The only real preference concept anywhere is a generic,
   non-ride-specific notification-channel toggle
   (`GET/PUT /customer/notifications/preferences`), keyed by a
   `NotificationType` enum with no ride-specific values (`RIDER_ASSIGNED`
   exists but is delivery-notification-shaped, not a ride customer
   preference). No default-payment-method, ride-type preference, or
   accessibility field exists anywhere. Neither of these two named screens
   (which weren't in the real Figma Make source at all — they were the
   founder's own extension names) maps to anything real. Not built.

5. **Ride Support / Ride Help** — no generic help-center, FAQ, or
   support-ticket system exists anywhere in the backend, confirmed by the
   backend's own code comment in `ride-problem-report.service.ts`: _"No
   support/ticket system exists anywhere in this codebase (confirmed by a
   schema-wide audit before writing this service)."_ The one real,
   ride-scoped analog — reporting a problem with a specific completed ride
   — is `RideProblemReport`, already built in Slice 3 as
   `ReportTripScreen`. Neither "Ride Support" nor "Ride Help" was in the
   real Figma Make source either. Rather than build two more screens whose
   only real content would be static copy plus a link to the
   already-existing report flow, nothing new was added — `ReportTripScreen`
   already covers the one real capability this pair of names points at.

6. **Emergency (SOS)** — confirmed absent, again, by the backend's own
   documentation: `ride-lifecycle.e2e.spec.ts` and
   `docs/RIDE-002.9-E2E-VERIFICATION.md` both explicitly state no
   SOS/emergency/trip-sharing feature exists anywhere in this backend. The
   real source's `EmergencySOSScreen` (Part 3) was already handled honestly
   in Slice 2/3 via `QuickActionButton`'s disabled SOS placeholder
   (auto-disables when no `onClick` is passed) rather than a fake working
   SOS flow. No change this slice — still not built as functional, per the
   same rule restated by the founder for this slice.

None of the above are silently dropped — they're logged here as backend
feature requests. If any becomes a real priority, the correct next step is
a backend design pass (schema + endpoint), not a frontend screen built
against nothing.

## Verification

- `apps/customer-web`: `npx tsc --noEmit` clean; `npx eslint` clean
  (`--max-warnings=0`) across all new/changed files; `npx vitest run` 4/4
  passed (unchanged — no new test files this slice, no new hooks with
  business logic beyond thin SDK wrappers already covered by the SDK's own
  test suite); `npm run build` clean — `/ride` route 31.6 kB (up from
  29.0 kB in Slice 3), all 21 routes still generate.
- Backend/SDK: unchanged this slice — no new endpoints, no new SDK methods.
  `useSetDefaultSavedPlace` wraps an SDK method (`sdk.addresses.setDefault`)
  that already existed and was already tested at the SDK level.

## Defects found

None. This slice was primarily a capability-boundary exercise — the main
finding is the 8:2 ratio between named screens and screens with real
backend support, documented above rather than papered over.
