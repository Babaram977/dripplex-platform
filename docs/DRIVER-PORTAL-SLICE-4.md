# Driver Portal — Slice 4: Earnings, Profile/KYC, Ride History

Build-order items 4 (Earnings), 5 (Driver Profile), and 7 (Ride History)
from the founder's spec. One minimal backend addition was needed; the rest
reuses Slice 1–2 SDK surface plus the existing driver-profile/KYC and
auth-password endpoints, none of which had a UI yet.

## Backend addition (minimum required, tested)

`RideRatingService` could create ratings but never read them back —
neither side of a ride had any way to see a rating once submitted, which
blocks Ride History's "Customer ratings" requirement. Added
`listRideRatings(driverId, rideId)` (`GET /driver/rides/:id/ratings`),
scoped to rides the driver was actually assigned to, returning both sides'
ratings (up to 2: the passenger's rating of the driver, the driver's rating
of the passenger) if they exist. Covered by 3 new tests in
`ride-rating.service.spec.ts`; SDK method + contract test added to
`DriverRideClient`.

## What was built

**`/earnings`** — a period toggle (Today/This week/This month) over
`useDriverRideStats` (extended from Slice 2 to also compute month totals,
still derived client-side from `RideDto.driverEarning` on the driver's own
completed rides — no wallet-ledger re-derivation). Embeds the existing
`WalletPanel` (balance + transaction history, already real, already built
for the Driver Growth Campaign) rather than rebuilding it. Links out to
`/campaign` for referral/promotion reward detail instead of duplicating
that UI.

**Withdrawal requests — identified, not built.** `WalletService.withdrawal()`
exists as an internal mutation-type helper but has zero callers anywhere in
the backend — there is no endpoint for a driver to request a payout, and
none is invented here. Building one is a real product decision (payout
provider, approval workflow, minimum amount, fees) needing founder
sign-off, the same discipline already applied to `RIDE_FARE_RATES`. The
Earnings screen states this honestly instead of a button that would either
fail silently or fake success.

**`/profile`** — personal information (name/email/phone/join date) is
read-only: there is no driver profile-update endpoint, stated plainly
rather than building a form with nowhere to submit. Vehicle details show
the one real field that exists (`DriverAvailability.vehicleType` —
Economy/Tricycle), with an explicit note that make/model/plate/colour
aren't captured anywhere in the schema (the gap already flagged in Slice
1's audit). Documents lists submitted KYC entries with their verification
status and a submission form — `frontImage`/`backImage` are plain URL
inputs, not a file picker, because the backend validates them as URLs
(`@IsUrl`) and there is no file-upload/storage endpoint anywhere in this
codebase. KYC/account status is the existing `DriverProfileDto.status`
badge. Account settings reuses the portal-agnostic
`POST /auth/password/change` (already wired for every portal, just never
given a driver-portal form before).

**`/history`** — All/Completed/Cancelled tabs over the Slice 2
`GET /driver/rides` endpoint, paginated (page/limit + Previous/Next, no
infinite scroll fabrication). Tapping a completed row opens
`TripFareSummary` (reused as-is from Slice 3 — same component, same data
shape) plus the new ratings display. Cancelled rows show status and
cancellation reason instead of a fare breakdown that doesn't apply.

## Verification

Backend: `tsc --noEmit` clean, `jest src/rides` 104/104 passing, ESLint
clean. SDK: rebuilt, `vitest run src/rides/driver-ride-client.spec.ts`
17/17 passing. Driver portal: `tsc --noEmit` clean,
`eslint --max-warnings=0` clean, `vitest run` 10/10 passing, `next build`
succeeds (13 routes, including the three new ones).
