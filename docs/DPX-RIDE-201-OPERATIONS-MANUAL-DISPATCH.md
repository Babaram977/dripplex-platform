# DPX-RIDE-201 — Operations Manual Dispatch (Future Ride Enhancement)

**Status: Deferred, not yet implemented.** Founder decision (2026-08-04),
recorded alongside approval of DPX-OPS-001 Phase 1's Slice 3 (Dispatch
Management): manual ride reassignment is real, wanted capability, but Ride
is a frozen module — this document exists so Slice 3 can build the
_visibility_ half of dispatch oversight now (eligible drivers, availability,
ETA, ratings) while the _action_ half (actually reassigning a ride) waits
for its own explicit founder-approved-enhancement pass into `rides/`,
instead of either being silently skipped or silently built without that
sign-off.

## The rule, exactly as the founder set it

In DPX-OPS-001 Slice 3, "Reassign Driver" is a real, visible control on an
in-progress ride's detail view. Selecting it lets Operations staff:

- View eligible nearby drivers
- See availability
- See ETA
- See ratings

**But no reassignment action executes yet.** The control surfaces the
decision-support information a dispatcher needs to make the call; it does
not yet make the call for them. This is deliberate, not an oversight —
recorded here so nobody "finishes" Slice 3 by wiring the button up without
this document being activated first.

## Why this needs its own founder-approved-enhancement pass

Reassigning an in-progress ride's driver is a _write_ into ride-lifecycle
state — unlike everything else DPX-OPS-001 Phase 1 needed (which reads
`Ride`/`RideOffer`/`DriverAvailability` directly from a new, separate
`operations/` module without touching a single frozen file), there is no way
to reassign a ride without either:

1. Calling into `RideDispatchService`/`RidesService` logic that lives in
   the frozen `apps/backend/src/rides/` module, or
2. Duplicating ride-lifecycle rules outside it — strictly worse, since it
   creates two sources of truth for what a valid ride-state transition is.

Per `docs/DPX-100-MODULE-COMPLETION-GATE.md`'s freeze policy, "explicit
founder-approved enhancement" is one of the five carve-outs that permits
touching a frozen module. This document is that explicit request, recorded
ahead of the actual scoping/implementation pass — not a blanket license to
touch `rides/` for anything DPX-OPS-001 turns out to want, only for this
one, named capability.

## What Slice 3 builds now (the visibility half)

Real, read-only, buildable entirely from the same `operations/` module the
rest of DPX-OPS-001 Phase 1 uses — no frozen-file changes:

- **Eligible nearby drivers** — same `haversineMeters`-style distance
  calculation and online/accepting-rides/vehicle-type filtering
  `RideTrackingReadService.getNearbyDrivers()` already uses for the
  customer-facing pre-booking map, but full-fidelity (no privacy fuzzing,
  no 20-result cap) and driver-identified, since this is an internal
  operations view, not a public-facing one.
- **Availability** — `DriverAvailability.online`/`acceptingRides`/
  `activeRideCount`, already read by DPX-OPS-001's fleet snapshot.
- **ETA** — derived client-side or via a real distance/duration estimate,
  matching the pattern the fare-estimate endpoint already uses elsewhere on
  the platform (not a fabricated number).
- **Ratings** — `RideRating` aggregate, the same `raterRole: CUSTOMER`
  average-rating computation `DriversService.getOwnPerformanceStats`
  already does for a driver's own profile (Driver Slice 2 item 9),
  reused read-only here for a different consumer.

## What activating this document later requires

- A real design pass on exactly what "reassign" does to the in-flight
  ride's state (does the departing driver get notified? Does a new
  `RideOffer` get created and accepted automatically, or does the new
  driver still need to accept? What happens to an in-progress trip's fare
  calculation if the reassignment happens mid-ride vs. before pickup?) —
  none of this is decided here, deliberately.
- The founder's explicit sign-off on the specific `rides/` files/methods
  this would touch, at the time it's actually scoped — this document
  records that the _category_ of change is pre-approved in principle, not
  that a specific diff is pre-approved sight-unseen.
- A permission decision: whether `operations:live:read`-level access (this
  module's Slice 1 permission) is sufficient to reassign a ride, or whether
  a distinct, higher-bar permission is warranted for an action this
  consequential — not assumed either way here.

## Why the visibility-only version is real, not a stub

Everything Slice 3 ships under this document's rule is genuinely useful on
its own: an Operations dispatcher can already see who's eligible, how far
away they are, and how they're rated, before this document's write-side is
ever activated. The "Reassign Driver" control existing with a real
decision-support panel behind it — and no action executing — is an honest
statement of what's built, not a disabled button with a fake "coming soon"
label pretending to be more than it is.
