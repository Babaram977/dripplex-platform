# RIDE-003 — Phase 1 Readiness Audit

No UI code in this document — this verifies the foundation RIDE-003 Phase 0 built
(commits `e71da96`, `4a70852`) is actually solid before Phase 2 (Figma mapping) and
Phase 3 (vertical slices) begin. Every item below was run and observed directly in
this session, not assumed.

## SDK exports

`CustomerRideClient` is wired into `DripplexClient` and `createCustomerSdk()` alongside
every other domain client (`packages/sdk/src/client/dripplex-client.ts`,
`packages/sdk/src/sdk.ts`), exported from the package barrel
(`packages/sdk/src/index.ts`). Verified via `pnpm build` (tsc, clean) in
`packages/sdk`.

**Status: ✅ ready.**

## SDK tests

`packages/sdk`'s own vitest suite — the one Phase 0 missed running before its first
push, which CI then correctly caught (`portal-sdk.spec.ts` asserts the exact key set on
`createCustomerSdk()`'s return value; fixed in commit `4a70852`).

```
Test Files  12 passed (12)
     Tests  62 passed (62)
```

**Status: ✅ ready**, and now included in this session's standard verification pass
going forward — `pnpm test` inside `packages/sdk`, every time the SDK changes, not just
build/lint/typecheck.

## Customer Web build

Ran the actual production build (`next build`), not just `tsc --noEmit` — these can
diverge (static generation, route collection, bundling can fail independently of
typecheck). Result: clean.

```
✓ Compiled successfully in 46s
✓ Generating static pages (20/20)
```

The only warnings are pre-existing and unrelated to Ride: a `require-in-the-middle`
critical-dependency notice from Sentry/OpenTelemetry instrumentation, and a Next.js
ESLint-plugin-detection notice. Twenty routes currently exist, none of them Ride —
confirming again that RIDE-003 is additive, not a refactor of anything shipping today.

**Status: ✅ ready.**

## Customer Web routing

Next.js App Router with three route groups:

- `(public)` — marketing pages **and marketplace browsing** (`/marketplace/*`) — no
  login required to browse products/merchants.
- `(auth)` — login, register, forgot/reset password, OTP verify.
- `(dashboard)` — currently just `/dashboard`, gated by `DashboardAuthGate` →
  `useRequireAuth()` (redirects to `/login` once the auth store has hydrated and the
  user isn't authenticated). Wrapped in a shell: `Sidebar` (desktop) +
  `DashboardHeader` + `BottomNavigation` (mobile, 5 fixed slots: Home / Shop / Orders /
  Wallet / Profile — **no Ride slot exists today**).

**Open question for Phase 2, not decided here:** does Ride live inside the
`(dashboard)` shell (sidebar + bottom nav visible), or does it need its own full-screen
route group without the shell — the way most ride-hailing apps present active-trip and
tracking screens without a persistent nav bar? This is a real layout decision the
approved Figma file will answer; not guessed at here. If it stays inside `(dashboard)`,
the bottom nav's 5 fixed slots also need a decision (add a 6th, replace one, or leave
Ride nav-less and reached only from the Home screen).

**Status: ✅ ready as infrastructure; ⚠️ one open placement decision for Phase 2.**

## React Query setup

`QueryClientProvider` is already live at the app root (`AppProviders` in
`@dripplex/hooks`, mounted in `apps/customer-web/src/app/layout.tsx`), with sensible
defaults already tuned for this codebase's error types (retries once on 429, never on
4xx, backs off using `DripplexApiError.retryAfterSeconds` when present). Confirmed
`@tanstack/react-query` was a transitive-only dependency before Phase 0 — zero
`useQuery`/`useMutation` calls existed anywhere in `customer-web` prior to the 12 Ride
hooks built in Phase 0, which are the first real usage of this already-configured
provider.

**Status: ✅ ready** (provider infra pre-existing; the Ride hooks are the first
consumers, not the first setup).

## WebSocket client readiness

`socket.io-client` added as a new direct dependency of `customer-web` in Phase 0 (the
server side, `RideGateway`, has existed since RIDE-002.5; nothing on the client side
ever connected to it before). `useRideTracking` joins the `ride:{id}` room, listens for
`ride:status` / `ride:payment` / `ride:driver_location`, and syncs the React Query
cache. Confirmed the base-URL derivation (`NEXT_PUBLIC_API_BASE_URL` with the `/api/v1`
suffix stripped, `/rides` namespace appended) matches the local `.env.example`
(`http://localhost:3000/api/v1` → `http://localhost:3000/rides`).

**Not verified**: the real Railway/Cloudflare production topology — whether the
Socket.IO gateway is reachable at the same host as the REST API, and whether it needs
sticky sessions behind a load balancer. This needs an actual connectivity check once
Slice 2 (Active Ride) is underway, not assumed clean from code alone.

**Status: ✅ ready locally; ⚠️ production connectivity unverified.**

## Authentication flow

`useAuth()` (`@dripplex/hooks`) exposes `hydrated`, `isAuthenticated`, `accessToken`,
`user`, `portal`. `useRequireAuth()` (`apps/customer-web/src/hooks/use-require-auth.ts`)
is the existing redirect-to-login pattern every authenticated route already uses —
Ride routes reuse it as-is, no new auth code needed. `useRideTracking` reads
`accessToken` directly from the same `useAuth()` hook for the WebSocket handshake.

**Status: ✅ ready, fully reusable as-is.**

## Existing shared components (`@dripplex/ui`)

`avatar`, `badge`, `button`, `card`, `drawer`, `dropdown-menu`, `empty-state`, `input`,
`label`, `loading-spinner`, `modal`, `select`, `skeleton`, `switch`, `textarea`,
`toast`. No map component, no bottom-sheet component (distinct from `drawer` — Figma's
"Payment"/"Rating" screens are described as bottom sheets in the founder's
kickoff message; whether `drawer` already covers that or a new primitive is needed is a
Phase 2 question once actual Figma component specs are visible), no stepper/progress
component for a multi-step ride-request flow.

**Status: ✅ solid base; ⚠️ likely needs 1-2 new primitives once Figma specifics are
known (not built speculatively here).**

## Existing design tokens

`DRIPPLEX_BRAND` (`packages/ui/src/brand/tokens.ts`): Emerald Green `#0E7A3E`
(primary), Deep Navy `#0A2540` (secondary), Sunshine Yellow `#FFC107` (accent), Light
Gray `#F4F6F8` (neutral), White. Tagline "life, Simplified". CSS tokens live in
`packages/ui/src/styles/globals.css`, required to stay in sync with these constants
(enforced by `tokens.spec.ts`). Per the founder's own design-constraint rule, these are
**not to be touched** by RIDE-003 — if the approved Figma file specifies different
values for Ride screens specifically, that's a founder-level decision to reconcile, not
an implementation one.

**Status: ✅ ready, locked.**

## Summary

| Area                 | Status                                                            |
| -------------------- | ----------------------------------------------------------------- |
| SDK exports          | ✅ ready                                                          |
| SDK tests            | ✅ ready                                                          |
| Customer Web build   | ✅ ready                                                          |
| Customer Web routing | ✅ ready — ⚠️ one open placement decision (shell vs. full-screen) |
| React Query setup    | ✅ ready                                                          |
| WebSocket client     | ✅ ready locally — ⚠️ production connectivity unverified          |
| Authentication flow  | ✅ ready, fully reusable                                          |
| Shared components    | ✅ solid base — ⚠️ likely 1-2 new primitives needed               |
| Design tokens        | ✅ ready, locked                                                  |

Nothing here blocks starting Phase 2 the moment Figma is connected. The two ⚠️ items
(shell placement, WS production connectivity) are flagged for that phase to resolve
with real information, not guessed at now.
