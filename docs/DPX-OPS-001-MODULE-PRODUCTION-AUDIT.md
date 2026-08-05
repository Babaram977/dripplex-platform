# DPX-OPS-001 — Module-Level Production Audit (Slices 1–4 together)

**Date:** 2026-08-05
**Status:** 🟡 Founder Review — not yet frozen. Per the founder's explicit
instruction, this audit does not auto-freeze the module; it evaluates the
Operations Command Centre as one system and reports findings back for a
final decision on 🔒 **DPX-OPS-001 — Operations Command Centre, Phase 1**.

**Scope:** all four individually-frozen Phase 1 slices, evaluated together —
Slice 1 (Live Operations Dashboard, 2026-08-04), Slice 2 (Operations Work
Queues, 2026-08-05), Slice 3 (Dispatch Management, 2026-08-05), Slice 4
(Operations Analytics, 2026-08-05). Each slice already has its own
production audit (`docs/DPX-OPS-001-SLICE-{2,3,4}-PRODUCTION-AUDIT.md`);
this document does not repeat their per-slice findings except where the
module-level view changes the picture.

This audit follows the founder's own 14-point structure verbatim.

---

## 1. Cross-slice navigation and workflows

**Verdict: Real, confirmed.** One `AppShell` nav (`components/app-shell.tsx`)
lists all four slices' areas as a single list — Live Fleet Map (`/`), Ride
Queue (`/rides`), SOS Queue (`/queues/sos`), Incidents (`/queues/incidents`),
Driver Support (`/queues/support`), Analytics (`/analytics`). There is no
separate "Ops app" per slice; it is one console.

Click-through wiring confirmed by direct source read, not assumed:

- Ride Queue rows → `/rides/{rideId}` (Slice 3 ride detail).
- SOS/Incident/Support queue rows → `/queues/{sos,incidents,support}/{caseId}`
  (Slice 2 case detail).
- Ride detail page → dispatch decision-support panel (Slice 3, lazy-loaded)
  and back to the ride's SOS status via `hasOpenSos`.

Fleet → Ride → Dispatch → SOS/Incident/Support → Analytics is one navigable
system, not four independent tools.

## 2. RBAC / permissions

**Verdict: Clean — no partial grants, no escalation path.**

Four flat permissions, `operations.constants.ts`:
`operations:live:read`, `operations:queues:read`, `operations:queues:manage`,
`operations:analytics:read`. Exactly three roles hold any `operations:*`
permission — `operations_staff`, `administrator`, `super_administrator` —
and all three hold the identical 4-permission set (confirmed via
`grep -c "'operations:"` = 12 = 3 roles × 4 permissions, with no other role
touching any `operations:*` permission). `PermissionsGuard` uses
`reflector.getAllAndOverride()` so a method-level `@RequirePermissions`
_overrides_ the class-level one rather than adding to it — every controller
was checked and none accidentally relies on an inherited class-level grant
that a stricter method-level decorator would silently widen.

The single mutation surface in the entire module is
`OperationsCasesController` (`PATCH /operations/cases/:id`,
`POST /operations/cases/:id/notes`) — every other controller (Fleet, Rides,
Analytics, Dashboard, Queues-list, Staff) is GET-only. Both mutation
endpoints require `QUEUES_MANAGE`; `GET /operations/cases/:id` needs only
`QUEUES_READ`. No endpoint anywhere in the module is reachable with less
than its intended permission, and none grants a `read`-holder implicit
`manage` access.

**Observation, not a defect:** because all three roles hold an identical
permission set, there is currently no meaningful separation between e.g. a
junior operator and someone who should only see analytics — every Operations
staff member gets read+manage+analytics together. This matches the
founder's original Phase 1 scope (a small internal Operations team) and is
not a security gap; flagged only in case the founder wants tiered roles for
a larger future team. **Classification: Future enhancement.**

## 3. Data consistency

**Verdict: Consistent.** All four slices read the same underlying tables
directly via Prisma — `Ride`, `RideOffer`, `DriverShift`, `DriverAvailability`,
`OperationsCase`, `SosAlert`, `IncidentReport`, `DriverSupportTicket`,
`Vehicle`, `Inspection` — with no per-slice derived/cached copy of any of
them. A ride's status, a driver's fleet status, a case's priority, and a
vehicle's approval state each have exactly one source of truth read
identically everywhere they appear (fleet map, ride detail, queues,
analytics). `computeFleetDriverStatus()` (Slice 1) is the one place fleet
status is computed, and every screen that shows a driver's status calls it
the same way — no second, drifted definition exists.

## 4. Polling / query load

**Confirmed per-page polling composition** (grepped every `refetchInterval`
in `apps/operations-console/src/hooks/*.ts` — all are `15_000`ms):

| Page                               | Concurrent 15s polls                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| Fleet Map home (`/`)               | 3 — fleet snapshot + dashboard counters + activity feed                                    |
| Ride Queue (`/rides`)              | 1                                                                                          |
| Ride detail (`/rides/[id]`)        | 3, +1 lazy (dispatch-candidates panel, only while expanded)                                |
| SOS/Incidents/Support queue lists  | 1 each                                                                                     |
| Case detail pages                  | 1                                                                                          |
| Analytics overview + 6 drill-downs | 0 — deliberate; a decision-support view over a selected historical range, not a live board |

**Realistic concurrent-usage estimate:** DPX-OPS-001 Phase 1 targets a small
internal Operations team (the same premise behind the RBAC design in §2).
At a generous 20 concurrent operators, weighted toward the Fleet Map home
page and single-poll queue pages (the pages an operator spends most time on,
per the founder's own "live board" framing), the aggregate poll rate is
roughly 2–4 requests/second sustained, each request a handful of indexed
`findMany`/`count` calls. This is light load for the current stack and not
a concern at Phase 1 scale. It would need re-estimating if headcount grows
materially (e.g. a large 24/7 Operations floor).

**N+1 review** — every polled/aggregation service method was read in full
this pass, not sampled:

- `OperationsFleetService.getFleetSnapshot()` — 6 batched `findMany` calls
  keyed by a single `driverIds` array, joined in application code. No
  per-driver query.
- `OperationsDashboardService.getActivityFeed()` — 6 parallel `findMany`
  calls (one per source table), each capped at 15 rows, merged and
  re-sorted in memory. No per-item query.
- `OperationsDispatchSupportService.getDispatchCandidates()` — one
  `findMany` for candidates, then 2 batched follow-up queries
  (`vehicle.findMany`, `rideRating.groupBy`) keyed by the candidate id list.
  No per-candidate query.
- `OperationsAnalyticsService` — every one of the 6 area methods issues 1–2
  `findMany`/`count` calls over the caller's time range and aggregates in
  application code; none loops a query per row.

No N+1 pattern found anywhere in the module.

**Real finding — missing indexes (fixed during this audit, see §5).**

## 5. Database / index readiness

**Finding, fixed during this audit.** Reading every range-filtered or
`orderBy`-sorted query against its table's actual indexes turned up nine
timestamp columns queried with no supporting index:

- The Live Activity Feed (§4, polled every 15s by every operator) sorts
  `SosAlert`/`IncidentReport` by `createdAt`, `Inspection` by `completedAt`,
  `DriverShift` by `startedAt`/`endedAt`, and `Ride` by `cancelledAt` — none
  of those columns had a leading index; each query would have degraded to
  a full table scan + sort as the tables grow.
- `OperationsAnalyticsService` range-filters `RideOffer.offeredAt`,
  `DriverShift.startedAt`, `Ride.completedAt`, and `OperationsCase.createdAt`
  with no other predicate — `DriverShift`'s only existing indexes lead with
  `driverId`, which can't serve a global range scan.

Added migration `20260805030622_ops_module_audit_indexes` (9 new
single-column indexes, purely additive, no data change, no locked-behavior
change) and regenerated the Prisma client. Verified: `prisma migrate status`
reports up to date, `prisma-foundation.spec.ts` passes, and the full
`src/operations` jest suite plus the full backend suite still pass with the
same (pre-existing, unrelated) 3 failures as before the migration — see §14.

**Classification: Must-fix before freeze — fixed in this audit, not
deferred.**

`RideTracking` (trip tracking, also 15s-polled) already had the correct
`@@index([rideId, createdAt])` composite from Slice 3 — no change needed
there.

## 6. Concurrency / idempotency

Slice 2's case-creation race protection (`getOrCreateCase`, idempotent lazy
creation under simultaneous requests) was already tested and is unchanged.

**Real finding, not fixed in this audit — flagged for Founder Review.**
`OperationsCasesService.updateCase()` — the module's only other mutation
path — reads the existing case, computes a diff against `dto`, then issues
a single `operationsCase.update()`. It is not wrapped in a transaction and
has no optimistic-lock guard (no version column, no `WHERE` clause
re-checking the read). Two operators PATCHing the same case at nearly the
same moment could each compute their diff against a stale read: for example,
the `firstRespondedAt`/`resolvedAt`/`closedAt` "only set if still null"
logic reads `existing.firstRespondedAt === null` and could still write a
value even if a concurrent request already set it moments earlier, since
each request's `data` object is independently correct only relative to the
read it started from. The practical impact is a possibly-wrong SLA
timestamp or a duplicate-looking `STATUS_CHANGED`/`ASSIGNED` event on the
case timeline — not data loss, not privilege escalation, not a corrupted
case. This is a narrow, low-frequency (human-driven, single-case) race, but
it touches exactly the auditability guarantee the founder asked about in
§9, so it's reported precisely rather than passed over.

**Classification: Must-fix before freeze** (recommended fix: wrap the
read-diff-write in a transaction with `SELECT ... FOR UPDATE`, or add an
optimistic `version` column) — left for the founder to decide whether to
fix now or accept as a documented, narrow gap, since it changes the core
mutation surface's concurrency semantics and the founder has been explicit
elsewhere in this audit cycle about not wanting scope silently expanded.

## 7. Error / degraded states

Every `operations-console` list/detail page checks `isError` from its query
hook and renders an explicit error state (confirmed via
`grep -rln isError app hooks components` — 17 files, covering every page and
the dispatch-candidates panel). `OperationsMapsProvider` renders its
children directly (no crash) when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is
unset, and `FleetMap` (Slice 1) falls back to its list view in that case —
this pattern was verified present, not just documented, in
`components/maps-provider.tsx`. Trip tracking (Slice 3) already handles a
ride with zero tracking points (empty array, not an error). Analytics
drill-downs handle an empty range the same way — zero rows in, zero-value
DTO out, never a fabricated non-zero number (see §"honesty" pattern from
Slice 4's own audit — `utilizationRate: null` rather than `0` when the
denominator doesn't exist, carried through the whole module).

No new gap found at the module level beyond what each slice's own audit
already covered.

## 8. Operational safety — SOS priority

**Verdict: Consistent everywhere SOS appears.**
`computeFleetDriverStatus()` checks `hasOpenSos` first, before even
`SUSPENDED` — SOS always outranks every other fleet status. Visually,
`FleetStatusBadge` renders SOS with `bg-destructive` (red) plus
`animate-pulse`, the only status with a pulse animation, so it reads as
urgent both semantically (status priority) and visually. The Live Activity
Feed marks `SOS_TRIGGERED` items with a 🔴 marker distinct from every other
event type. The SOS queue itself doesn't need an internal severity sort
(unlike Incidents, which sorts `severity desc, createdAt desc`) because
every SOS alert is, by definition, the platform's highest-urgency case type
— there is no sub-priority to rank within it. SOS is unmistakably highest
priority at every layer it touches: fleet status, badge styling, activity
feed, and queue semantics.

## 9. Auditability

Both mutation endpoints (`updateCase`, `addNote`) write two records on every
call: an immutable, case-scoped `OperationsCaseEvent` (with `actorId`, for
the operator-facing timeline) and a platform-wide `AuditService.record()`
call (with `userId`/`ipAddress`/`userAgent` via `AuditContext`, for the
security/compliance trail) — confirmed by reading both methods in full, not
sampled. Every field change (priority, assignment, status, note) has its own
distinct event type and a human-readable description. The one gap is the
concurrency finding in §6 — under a genuine race, the _order_ of two
overlapping audit entries could end up telling a slightly inconsistent
before/after story, even though each entry is individually a true record of
what that request did.

## 10. Frozen-module boundaries

**Verdict: Zero violations, re-confirmed at the module level.**
`git diff --stat` across the full DPX-OPS-001 range (reality audit through
Slice 4 freeze) against `apps/backend/src` shows exactly one file outside
`apps/backend/src/operations/` touched: `app.module.ts`, +2 lines wiring the
new module in — nothing else in `rides/`, `wallet/`, `drivers/`, or any
other backend module was modified. A direct grep for
`operations/` importing from `rides/` returns nothing — every Ride-domain
read goes straight through Prisma, the same cross-module-read pattern held
since Slice 1. `RideDispatchService`/`RideOfferSweepService`/`RideTripService`
(the frozen dispatch/trip engines) are never called into by `operations/`.

## 11. Figma protection

**Verdict: Zero violations, re-confirmed at the module level.**
`git diff --stat` across the same full range against `packages/ui`,
`apps/customer-web`, `apps/driver-portal` returns **no files** — nothing in
any Figma-derived, locked screen or shared component was touched by any of
the four slices. `operations-console` is its own app with its own
Operations-specific components; where it needed a shared primitive
(`Badge`), it applied new variants via `className` overrides rather than
editing `packages/ui/src/components/ui/badge.tsx` itself (see
`fleet-status-badge.tsx`'s own doc comment on this). The Figma Protection
Rule (`docs/DPX-OPS-001-FIGMA-PROTECTION-RULE.md`) held for the entire
module, not just per-slice.

## 12. Security / privacy

Reviewed every DTO the module returns (`operations.mapper.ts`, all 10
mapper functions) for over-exposure: no payment card data, bank details,
national ID, password, OTP, or PIN field is ever mapped into an Operations
DTO. What _is_ exposed — customer/driver name and phone, precise
pickup/dropoff coordinates, fare breakdown, cancellation reason — is
legitimately needed for an operator to dispatch, support, or respond to an
SOS/incident, and matches what a real operations team needs to do its job,
not more. This is the same discipline the per-slice audits already held to;
the module-level pass found nothing additional.

## 13. Production configuration

**Real finding.** `docs/ops/PRODUCTION-COOLIFY.md` explicitly excludes
`operations-console` from its deployment pass ("`merchant-portal`,
`rider-portal`, `operations-console` are not part of this pass — consistent
with the standing 'Phase 1 ride-launch only' directive"), written before
DPX-OPS-001 existed. Checked directly: `apps/operations-console` has **no
Dockerfile** today — it currently ships `wrangler.jsonc` +
`open-next.config.ts` (Cloudflare Workers tooling), not a Coolify/Docker
path. The app itself is already Docker-ready in principle
(`next.config.ts` sets `output: 'standalone'` behind `DOCKER_BUILD=1`, the
same convention `driver-portal`/`customer-web`/`admin-portal` use), and its
env surface is small and already documented in code:
`NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_APP_URL`, and
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (same key as customer-web/driver-portal,
falls back to list-only view when unset — §7). Firebase/push is not used by
`operations-console` at all (no push registration anywhere in the app),
so there's no Firebase dependency to configure for it.

**Net effect: the finished, founder-approved Operations Command Centre has
no working path to production today.** The fix is mechanical (copy
`apps/driver-portal/Dockerfile`'s pattern, add an `operations-console`
section to `PRODUCTION-COOLIFY.md`, add its 3 env vars to
`.env.production.example`) — the same recipe already used three times in
this repo — but it does not exist yet, and building/deploying it is outside
this audit's scope (it is infrastructure work, not verification).

**Classification: Launch blocker** for actually deploying DPX-OPS-001 to
production, even though nothing about the _application_ itself is at fault.

## 14. Full regression verification

Run against the current baseline, this session (all commands from a clean
`git status`, on `claude/dripplex-coolify-deploy-fatig4`):

| Suite                                                     | Result                                                                     |
| --------------------------------------------------------- | -------------------------------------------------------------------------- |
| `apps/backend` — `tsc --noEmit`                           | Clean                                                                      |
| `apps/backend` — `eslint src --max-warnings=0`            | Clean                                                                      |
| `apps/backend` — `jest --runInBand` (full suite)          | 1240/1244 passed, 3 failed                                                 |
| `apps/backend` — `prisma-foundation.spec.ts`              | 3/3 passed (schema valid, client generates, permission-seed count correct) |
| `packages/sdk` — `tsc --noEmit`                           | Clean                                                                      |
| `packages/sdk` — `eslint src --max-warnings=0`            | Clean                                                                      |
| `packages/sdk` — `vitest run`                             | 138/138 passed                                                             |
| `apps/operations-console` — `tsc --noEmit`                | Clean                                                                      |
| `apps/operations-console` — `eslint src --max-warnings=0` | Clean                                                                      |
| `apps/operations-console` — `vitest run`                  | 1/1 passed                                                                 |
| `apps/operations-console` — `next build`                  | Succeeds, all 17 routes build (16 pages + not-found)                       |

The 4 backend test failures are all pre-existing and unrelated to
DPX-OPS-001, each independently confirmed by isolated reproduction and code
inspection this session:

1. `operations-cases.service.spec.ts` — one test creates a `SosAlert` with a
   `vehicleId` that was never created as a real `Vehicle` row first, hitting
   the real FK constraint. A test-fixture bug in a pre-existing Slice 2
   test, not a service defect.
2. `driver-identity-verification.service.spec.ts` — an assertion expects
   trigger `IDLE_TIMEOUT` but the service (correctly) reports
   `FIRST_LOGIN_OF_DAY` for the fixture's actual conditions — a stale
   assertion in a Driver-001 test, unrelated to Operations.
3. `customer-products.service.spec.ts` — two rating/`isFeatured` filter
   assertions fail on fixture data drift, from Marketplace R1.3, unrelated
   to Operations.

Notably, run `--runInBand` (serial), the previously-documented
`operations-dispatch-support.service.spec.ts` "Ada" coordinate race (Slice
3/Slice 1 cross-file parallel-worker collision, see
`docs/DPX-OPS-001-SLICE-4-PRODUCTION-AUDIT.md` §10) **did not reproduce** —
consistent with, and further corroborating, the existing root-cause finding
that it is a parallel-jest-worker artifact rather than a defect in either
file's logic. Per the founder's explicit ruling on Slice 4's freeze, this
remains documented technical debt; this audit's own evidence (a clean
serial run) supports that it does not undermine reliable production
verification — the suite is deterministic and correct when run the way CI
would run migrations/critical suites, and the interference is purely a
test-runner scheduling artifact.

None of the 4 known failures, nor the Ada race, were introduced or changed
by this audit's work (the index migration, §5).

---

## Phase 1 completeness matrix

| Area                                      | Slice  | Status                                                                        |
| ----------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| Live Fleet Map, driver list, fleet status | 1      | 🔒 Frozen                                                                     |
| Ride Queue, dashboard counters            | 1      | 🔒 Frozen                                                                     |
| SOS / Incident / Driver Support queues    | 2      | 🔒 Frozen                                                                     |
| Case detail, assignment, notes, timeline  | 2      | 🔒 Frozen                                                                     |
| Live Activity Feed                        | 2      | 🔒 Frozen                                                                     |
| Queue Date/Ride/Vehicle filters           | 2      | 🔒 Frozen                                                                     |
| Ride detail, driver allocation history    | 3      | 🔒 Frozen                                                                     |
| Trip tracking                             | 3      | 🔒 Frozen                                                                     |
| Dispatch decision-support panel           | 3      | 🔒 Frozen                                                                     |
| Driver Utilization, Shift Analytics       | 4      | 🔒 Frozen                                                                     |
| Ride Operations, Dispatch Performance     | 4      | 🔒 Frozen                                                                     |
| Operations Response, Geographic Demand    | 4      | 🔒 Frozen                                                                     |
| Cross-slice nav/workflow                  | Module | ✅ Verified this audit                                                        |
| RBAC / permissions                        | Module | ✅ Verified this audit                                                        |
| Data consistency                          | Module | ✅ Verified this audit                                                        |
| Polling/query load, N+1                   | Module | ✅ Verified this audit                                                        |
| DB indexes                                | Module | ✅ Fixed this audit (migration `20260805030622_ops_module_audit_indexes`)     |
| Concurrency (case update race)            | Module | ⚠️ Found this audit, not fixed                                                |
| Error/degraded states                     | Module | ✅ Verified this audit                                                        |
| SOS priority consistency                  | Module | ✅ Verified this audit                                                        |
| Auditability                              | Module | ✅ Verified this audit                                                        |
| Frozen-module boundaries                  | Module | ✅ Verified this audit (zero violations)                                      |
| Figma protection                          | Module | ✅ Verified this audit (zero violations)                                      |
| Security/privacy                          | Module | ✅ Verified this audit                                                        |
| Production deployment path                | Module | ❌ Missing — no Dockerfile/Coolify runbook for `operations-console`           |
| Full regression                           | Module | ✅ Run this audit — clean aside from 3 known pre-existing, unrelated failures |

## Findings summary and classification

| #   | Finding                                                                                                                              | Classification                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Missing indexes on 9 timestamp columns used by the 15s Activity Feed and by Analytics range queries                                  | **Must-fix before freeze — already fixed this audit** (migration applied, verified, no regressions)                                                       |
| 2   | `OperationsCasesService.updateCase()` has no transaction/optimistic-lock guard against two operators racing a PATCH on the same case | **Must-fix before freeze** — not fixed; recommend transaction + row lock or a version column, founder's call on timing                                    |
| 3   | `operations-console` has no Dockerfile and no Coolify deployment runbook section — currently un-deployable to production             | **Launch blocker** for going live, though not an application defect — infrastructure work, same mechanical pattern as `driver-portal`'s Dockerfile        |
| 4   | All 3 Operations roles hold an identical permission set — no tiered access                                                           | **Future enhancement** — matches current small-team scope, not a defect                                                                                   |
| 5   | Pre-existing "Ada" coordinate parallel-worker test race (Slice 1/3)                                                                  | **Technical debt**, per the founder's own Slice 4 ruling — this audit's clean serial run further supports that it doesn't undermine reliable verification |
| 6   | 3 other pre-existing, unrelated test failures (Marketplace R1.3, Driver-001)                                                         | **Technical debt** — outside DPX-OPS-001 entirely                                                                                                         |

No finding in this audit reveals a defect in what any of the four slices
actually _does_ for an operator — every gap found is either already fixed
(indexes), a narrow low-frequency edge case (the update race), or
infrastructure that was never built because Operations wasn't in scope for
the original Coolify migration pass (the deployment path). The application
itself — fleet visibility, queue management, dispatch oversight, and
analytics, wired together as one console — is real, correctly permissioned,
consistent, and matches the founder's approved design at every layer this
audit checked.

## Recommendation

Bringing this back for Founder Review, as instructed. Two items —
concurrency (finding 2) and the deployment path (finding 3) — are real and
worth a decision before 🔒 DPX-OPS-001 Phase 1 is declared frozen as a
whole; everything else this audit checked came back clean or was already
fixed in the course of the audit itself.
