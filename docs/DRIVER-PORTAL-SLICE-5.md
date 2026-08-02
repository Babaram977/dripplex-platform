# Driver Portal — Slice 5: Notifications Wiring + Full Verification

Build-order item 6 (Notifications) and item 9 (final verification) from the
founder's spec. This is the last slice of the Driver Portal MVP.

## Backend additions (minimum required, tested)

Reused the existing Notification Center (`NotificationCenterSubscriber`,
`NotificationBell` — already present in driver-portal's `AppShell` since
the Driver Growth Campaign build) rather than building anything new. An
audit of every ride domain event against the spec's required list — "Ride
assigned, Ride cancelled, Payment received, Referral rewards, Promotions,
System alerts" — found two real gaps, both closed:

- **Ride cancelled** had no domain event at all, for either party. Neither
  `RidesService.cancelRide` (customer-initiated) nor
  `RideTripService.cancelByDriver` (driver-initiated) emitted anything the
  Notification Center could see — only email and the WS `ride:status`
  event. Added `DOMAIN_EVENTS.RIDE_CANCELLED`, emitted from both call
  sites. Each emission includes only the id of the party who _didn't_
  cancel (`driverId` when the customer cancels, `customerId` when the
  driver cancels), so a single subscriber mapping with
  `userKeys: ['driverId', 'customerId', 'userId']` naturally routes to
  whichever side needs to know — the same pattern `DELIVERY_ASSIGNED`
  already uses for `riderId` vs `customerId`. Reuses the existing
  `NotificationType.GENERIC` — no schema migration needed.
- **Payment received** (driver side) had no domain event either.
  `RIDE_PAYMENT_SUCCEEDED` exists but only fires from the customer's
  online-gateway verify flow; a driver confirming cash
  (`RidePaymentService.confirmCash`) never touched the event bus. Added
  `DOMAIN_EVENTS.RIDE_CASH_CONFIRMED`, emitted from `confirmCash`,
  targeting `driverId`, reusing the existing `NotificationType.
PAYMENT_SUCCESS` with driver-appropriate copy ("You confirmed a cash
  payment of ₦X") instead of the customer-phrased text the existing
  `RIDE_PAYMENT_SUCCEEDED` mapping uses.

"Ride assigned" for the driver was deliberately **not** given a new
in-app entry: the driver already gets a real FCM push + WS `ride:offered`
event the moment a ride is offered (wired in RIDE-002.4/DPX-CORE-001,
verified real in the Slice 1 audit), and they're looking at their own
screen when they tap Accept — a bell notification confirming an action
they just took themselves would be redundant, not a gap. Referral rewards,
promotions, and system alerts were already fully wired (driver-scoped
`DRIVER_REFERRAL_*` events, `PROMOTION_CREATED`, `WELCOME`, etc.) — nothing
to add.

No new UI: `NotificationBell` reads generically from
`GET /driver/notifications` and needed no changes to start surfacing these
two new event types once they fire.

`deepLink` was deliberately omitted on both new mappings — the correct
destination differs by which portal receives the notification (customer-
web vs driver-portal have different route layouts), and a single hardcoded
path can't serve both correctly. Matches the subscriber's own stated
convention: "Only set where a real destination route exists — omitted
(not a guessed fallback) rather than mapped to some page for every event
type."

Tests: `RideTripService.cancelByDriver` now asserts `RIDE_CANCELLED` fires
with `customerId`; `RidesService.cancelRide` asserts it fires with
`driverId`; `RidePaymentService.confirmCash` asserts `RIDE_CASH_CONFIRMED`
fires with `driverId`. All via `jest.spyOn` on a real `DomainEventBus`
instance, matching how these services are already tested elsewhere in this
codebase.

## Full verification (all 5 slices)

- **Backend**: `tsc --noEmit` clean. Full suite: **137 test files, 1003
  tests, all passing** (not just the rides/notification-center subset —
  the complete backend). ESLint clean on every file touched across all 5
  slices.
- **SDK**: rebuilt clean. Full suite: **16 test files, 88 tests, all
  passing**.
- **Driver portal**: `tsc --noEmit` clean. `eslint --max-warnings=0`
  clean. `vitest run`: 10/10 passing. `next build`: succeeds, all 13
  routes (dashboard, campaign, rewards, activity, leaderboard, earnings,
  history, profile, learn, login, trip, wallet, not-found).

## Driver Portal MVP — what shipped across Slices 1-5

Dashboard (online toggle, live stats, active-trip summary, referral/
promotion status) · real-time incoming-ride offers (WS + push, countdown,
accept/decline) · full active-ride workflow (navigate, arrive, start,
live trip info, end, fare summary, cash confirmation, passenger rating) ·
device-Maps navigation deep links · earnings breakdown + wallet + ride
history with per-trip detail and ratings · driver profile, KYC document
submission, and account settings · notifications for every real driver-
relevant ride/payment/referral/promotion event.

## Capability gaps documented across all 5 slices (not fixed, by design)

1. `RideDto` never exposes the customer's name/phone to the driver, even
   post-acceptance (Slice 2/3) — a real product/privacy decision, not a
   minimum addition.
2. No file-upload/storage endpoint anywhere in the backend — KYC document
   submission takes a hosted image URL, not a file picker (Slice 4).
3. No vehicle make/model/plate/colour fields anywhere in the schema — only
   the broad Economy/Tricycle category (Slice 2/4).
4. No driver self-service withdrawal/payout endpoint — `WalletService.
withdrawal()` exists but has zero callers; building one needs founder
   sign-off on a payout provider and approval workflow (Slice 4).
5. No real Google Maps SDK integration — `MapCanvas` is the same
   documented decorative placeholder RIDE-003 already established for
   customer-web, kept drop-in-replaceable; real navigation today is a
   device-Maps deep link, which needs no API key and isn't a placeholder
   (Slice 3).

None of these block the Kano launch workflow described in the founder's
spec; each is either a deliberate scope boundary or a genuine business
decision outside a UI engineer's authority to invent.
