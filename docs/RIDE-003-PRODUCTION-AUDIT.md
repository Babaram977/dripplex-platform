# Ride Production Readiness Audit

Commissioned by the founder after Slice 4 approval, with an explicit
instruction: audit first, fix nothing until the audit is signed off, then
fix only verified issues — not speculative ones. This document is that
audit. No code was changed while writing it.

## Methodology and honest limits

This sandbox has no `DATABASE_URL`/`REDIS_URL`/JWT secrets and no way to
reach a live backend (confirmed repeatedly since Slice 2 — `pg_isready`
fails, no Docker daemon, backend `npm run dev` fails immediately on
missing env). That means this audit is **static** — full read-through of
every screen, hook, and shared primitive in
`apps/customer-web/src/components/ride/` and
`apps/customer-web/src/hooks/rides/`, cross-referenced against the real
backend source and `docs/design/DDS-002-RIDE-DESIGN-SYSTEM.md` — not a
runtime audit. Concretely, that means:

- **Can verify from code, with certainty**: exact colors/spacing/radius/
  fonts against DDS-002; presence or absence of loading/empty/error
  states, `aria-label`s, retry/polling logic, React Query configuration;
  WCAG contrast ratios (computed directly from the real hex/rgba values
  and the WCAG relative-luminance formula, not estimated); fixed-pixel
  layout elements that will overflow a given viewport width (computed
  from the actual `width`/`viewBox` attributes, not observed in a
  browser).
- **Cannot verify without a live app + real device**: actual screen-reader
  behavior, real network-condition WebSocket failures, real Lighthouse/
  performance-trace numbers, real render-count profiling. Where a finding
  below depends on live behavior I can't reproduce here, it's phrased as
  what the code implies, not as an observed result.

Scope: every file under `apps/customer-web/src/components/ride/` (21
screens + `ride-ui.tsx` + `ride-flow.tsx`, 3,932 lines) and
`apps/customer-web/src/hooks/rides/` (14 files).

---

## 1. Production blockers

### 1.1 Five of the six active-ride screens have no fallback if the WebSocket never connects

`useRideStatusTransition` (`use-ride-status-transition.ts`) — the hook
driving screen transitions on `DriverAssignedScreen`, `DriverEnRouteScreen`,
`DriverArrivedScreen`, and `RideInProgressScreen` — reads `ride.data.status`
from the React Query cache and does nothing else. The cache is only ever
updated by `useRideTracking`'s `ride:status` WebSocket handler; there is no
`refetchInterval`, no manual poll, nothing. If the socket never connects,
these four screens sit frozen forever with a permanent "CONNECTING" badge
— a driver could actually arrive and start the trip in the backend, and
the customer's screen would never move past "Driver on the way."

This is a real, live risk, not a hypothetical one:

- `deriveSocketUrl()` (`use-ride-tracking.ts:43`) has its own comment
  admitting it's **"not verified against the real deployment topology
  yet, only against the gateway's own code"** — the URL-derivation logic
  has never been checked against how the backend is actually deployed.
- The socket is created with `transports: ['websocket']` only
  (`use-ride-tracking.ts:72`) — no long-polling fallback. Socket.IO's
  default behavior upgrades from polling to WebSocket; forcing
  WebSocket-only means any network that blocks raw WS upgrades (some
  corporate proxies, some mobile carrier configurations) fails outright
  with no fallback transport.
- Two other screens in the same module — `FindingDriverScreen`
  (`finding-driver-screen.tsx:35-47`) and `CashPaymentScreen`
  (`cash-payment-screen.tsx:43-52`) — were each built with their own
  manual 4-second poll specifically _because_ their authors recognized
  this exact risk (both have comments to that effect). That fix was never
  centralized into `useRideStatusTransition` itself when it was created
  in Slice 2, so the four screens built on top of it since never inherited
  it. This is an inconsistency across the same module, not a one-off gap.

**Fix**: add a poll fallback directly to `useRideStatusTransition` (same
pattern as `FindingDriverScreen`'s: `refetch()` every ~4s while the
current status isn't in `targets`), so the fix applies to all four
screens at once instead of being copy-pasted per screen again.

### 1.2 Query (GET) failures render as empty or stale states, not error states, on almost every screen

Only 7 of 21 screens handle `.isError`/`.error` at all, and all 7 are for
**mutations** (payment, tip, report, rating, saved-place create/update,
fare estimate) — real user-triggered actions with a "Try again" message
already wired. Zero screens check `.isError` on their `useQuery` reads.
Concretely:

- `RideHistoryScreen` (built this slice): if `useRideList` fails — expired
  token, 500, network drop — the screen shows **"No rides here yet."**
  (`ride-history-screen.tsx:88-95`), which is actively wrong: it tells the
  customer they have no ride history when the real answer is "the request
  failed."
- `SavedPlacesScreen`: same pattern — a failed `useSavedPlaces()` fetch
  renders as **"No saved places yet."**, not an error.
- `DriverAssignedScreen`, `DriverEnRouteScreen`, `RideInProgressScreen`,
  `LiveTrackingScreen`: all default missing/failed `ride.data` fields to
  `'—'` placeholders with no distinction between "still loading" and
  "failed to load."

This is systemic, not a one-screen bug — every screen reading `useRide`/
`useRideList`/`useSavedPlaces`/`useRideReceipt` has this gap.

**Fix**: a shared pattern (not a new primitive — reuse `StatusBanner`'s
existing `error` tone) that renders an explicit "Couldn't load this —
Retry" state whenever `.isError` is true, applied screen by screen.

---

## 2. Defects

### 2.1 Systemic WCAG AA contrast failure on the "muted" text token

DDS-002's `rgba(255,255,255,.38)` — the single most-used secondary/meta
text color in the entire kit (timestamps, subtitles, helper text, section
labels; used on nearly every screen) — fails WCAG AA's 4.5:1 minimum for
normal-size text against **both** real backgrounds it's used on:

- Against `#0A1628` (the more common background): computed contrast ratio
  **3.57:1**.
- Against `#112238` (card/surface background): computed contrast ratio
  **3.47:1**.

(Computed via the standard WCAG relative-luminance formula from the
literal hex/rgba values in `DDS-002-RIDE-DESIGN-SYSTEM.md` §1 — not
estimated.) Both fall short of the 4.5:1 AA threshold for normal text;
they'd pass the relaxed 3:1 threshold that only applies to large text
(18pt+/14pt-bold+), which most uses of this token aren't (it's used at
10-13px throughout). By contrast, the "dim" token
(`rgba(255,255,255,.6)`) computes to **7.06:1** against `#0A1628` — comfortably
passes AA and AAA. This is specifically a `.38`-opacity problem, not a
dark-theme-in-general problem.

**Fix candidates** (a founder decision, since DDS-002 is frozen and this
is a token value, not a code bug): raise the opacity from `.38` to
somewhere around `.5–.55` (still visually "muted" relative to `.6`/`.8`/
white, but passes 4.5:1), or reclassify actual current `.38` uses that are
large/bold enough to legitimately use the 3:1 large-text threshold.

### 2.2 `MapCanvas` is a fixed 390px-wide SVG — crops on any viewport narrower than 390px

`MapCanvas` (`ride-ui.tsx:445`) renders `<svg width="390" height="320"
viewBox="0 0 390 320">` with no responsive sizing (no `w-full`, no
`max-width`, no percentage width) — the SVG always occupies exactly 390
CSS px regardless of its container. Every screen wraps it in a plain
`<div>` with no width constraint, so on any device narrower than 390px —
**iPhone SE (375px), most small Android phones (360px)** — the right edge
of the map illustration (up to 30px on a 360px device) is cut off. It
doesn't cause a page-level horizontal scrollbar only because every
screen's outer wrapper has `overflow-hidden` — but that means the
content is silently clipped, not scrollable into view. This affects every
screen using `MapCanvas`: `RideHomeScreen`, `FindingDriverScreen`,
`DriverAssignedScreen`, `DriverEnRouteScreen`, `DriverArrivedScreen`,
`RideInProgressScreen`.

**Fix**: drop the `width`/`height` attributes in favor of `className="w-full h-full"`
(the `viewBox` already defines the internal coordinate system, so this is
a pure CSS change, not a redraw).

### 2.3 One self-introduced DDS-002 token deviation (Slice 4)

Re-running the same `grep`-based token audit used in RIDE-003A against
this slice's own new files found one real deviation:
`ride-history-screen.tsx` uses `rgba(239,68,68,.7)` for a cancellation-
reason text color. DDS-002 §1 documents the danger-tint family's real
range as `rgba(239,68,68,.08–.3)` — `.7` is outside that documented
range, a value I introduced without checking it against the table I
myself had just written. Every other color/radius/font-size in both new
Slice 4 screens matched the table exactly (re-verified via the same
`grep -rohE` sweep used in RIDE-003A).

**Fix**: replace with the plain `#EF4444` hex token (already documented,
already used for "destructive actions, error states" elsewhere) instead
of inventing a new opacity step.

### 2.4 `useRideStatusTransition` is called twice per screen (same cache key, no extra network cost, but redundant)

Every screen using `useRideStatusTransition` (which itself calls
`useRide(rideId)` internally) also calls `useRide(rideId)` directly for
its own data needs — e.g. `RideInProgressScreen` calls `useRide(rideId)`
on line 19 and `useRideStatusTransition(rideId, ...)` (which calls
`useRide` again internally) on line 21. React Query dedupes by query key,
so this is **not** a duplicate network request — but it is two separate
`useQuery` subscriptions doing the same job, which is unnecessary
indirection. Minor; listed as a defect in structure, not behavior.

---

## 3. Technical debt

### 3.1 `fontFamily: "'Inter',sans-serif"` / `"'Poppins',sans-serif"` repeated 124 times

83 uses of the Inter literal and 41 of the Poppins literal, as an inline
`style` object, across 3,932 lines — never extracted into a class or
constant. This is workable today because Slice 4 froze the design system
and nothing is changing these values, but it means any future global
typography change (e.g. fixing 2.1 above by adjusting a color that
happens to live in the same `style` object in dozens of places) touches
every call site individually instead of one definition. Not urgent under
the current freeze; worth flagging before any post-freeze typography
change.

### 3.2 Zero skeleton loading states anywhere in the Ride module

Every loading state across all 21 screens is plain text ("Loading…",
"Loading your rides…", "Loading saved places…") — never a skeleton
placeholder shaped like the eventual content. Not a defect (the text
states are honest and functional), but a real gap versus what "production
polish" usually means for a ride-hailing app's perceived performance,
especially on `RideHistoryScreen`'s list and `RideHomeScreen`'s saved-
places section where a shaped skeleton would reduce perceived latency
more than a text line does.

### 3.3 No offline handling anywhere in the Ride module

`navigator.onLine`/online-offline event handling exists elsewhere in the
app (`navbar.tsx`, the PWA service-worker registration) but nowhere in
`components/ride/`. A ride mid-flight with a dropped connection shows
whatever state it was last in — no "You're offline" banner, no
distinction from a slow network. Given `RideHistoryScreen`,
`SavedPlacesScreen`, and effectively every active-ride screen depend on
either polling or a live socket, this is worth a deliberate decision
(build a shared offline banner vs. accept it as a known gap) rather than
silently carrying it forward.

---

## 4. Improvements

- **Touch targets below 44×44 (WCAG 2.5.5 / Apple HIG guidance, not a
  hard AA failure — WCAG 2.5.8's AA minimum is 24×24, which these do
  meet)**: `BackArrow` and the new `RideHomeScreen` history button are
  40×40 (`h-10 w-10`); the tab/segmented-control buttons in
  `RideHistoryScreen`/`SavedPlacesScreen`'s label picker are 36px tall
  (`h-9`). The 36px tabs are copied verbatim from the real Figma Make
  source (not introduced by generated code), so per the established
  source-of-truth priority this is flagged, not silently "fixed" —
  a founder call on whether AAA-level touch-target comfort outranks
  fidelity to the received design here.
- **Reconnect visibility**: `tracking.connected` renders a LIVE/CONNECTING
  badge on 3 screens, but "CONNECTING" is shown identically whether the
  socket is initially connecting or has failed and given up — no
  distinct "couldn't connect, tap to retry" state once reconnection
  attempts are exhausted.
- **`RideHistoryScreen` pagination** uses Previous/Next rather than
  infinite scroll — a deliberate choice this slice (documented in
  `RIDE-003-SLICE-4.md`) to stay honest about real page-based pagination
  rather than fake an accumulating list; worth a product call on whether
  infinite scroll (backed by real accumulated pages) is worth building
  later.

## 5. Nice-to-have enhancements

- A shared `<Text>`/typography helper component to collapse the 124
  repeated `fontFamily` inline styles (ties into 3.1 above) — only worth
  doing alongside a deliberate post-freeze typography pass, not as a
  standalone refactor under the current freeze.
- Skeleton loading components for list-shaped content (`RideHistoryScreen`,
  `SavedPlacesScreen`, `RideHomeScreen`'s saved-places section).
- A shared "couldn't load — retry" empty-state component to fix 1.2 above
  consistently rather than per-screen.

---

## What this audit did not (and could not) check

- Real screen-reader output (VoiceOver/TalkBack) — no way to run one in
  this sandbox.
- Actual WebSocket behavior under real network conditions (corporate
  proxy, carrier NAT, real reconnect timing) — 1.1's risk is inferred
  from the code's configuration, not observed failing live.
- Lighthouse/real performance traces, real React DevTools render-count
  profiling — no live authenticated app reachable here (no `DATABASE_URL`
  anywhere in this environment, unchanged since Slice 2).
- Bundle size is trending up predictably with each slice (`/ride`: 25.0 kB
  → 29.0 kB → 31.6 kB across Slices 2-4) but there's no bundle-analyzer
  breakdown here of what's contributing — worth running `@next/bundle-analyzer`
  in an environment that can actually build and inspect it, if bundle size
  becomes a concern.

## Recommended order once this is reviewed

1. Fix 1.1 and 1.2 (production blockers) first — these are the only
   findings that can strand a paying customer mid-ride with money on the
   line.
2. Fix 2.3 (one-line token fix) alongside them since it's trivial.
3. Bring 2.1 (contrast) and 2.2 (MapCanvas overflow) back for a founder
   decision, since both require either a design-token change or a visual
   change to something explicitly frozen — not something to just change
   unilaterally under the current freeze rules.
4. Everything else (3.x, 4.x, 5.x) is real but not urgent — schedule
   opportunistically, not as a blocking pass.
