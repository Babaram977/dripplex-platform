# DPX-OPS-001 Slice 2 — Production Audit

Run per the founder's own governance ("Implement → Verify → Document →
Production Audit → Founder Review → Freeze") and the founder's explicit
instruction after reviewing Slice 2's initial ship: close the Date/Ride/
Vehicle filter gap, leave the frozen `IncidentCategory` enum untouched, and
specifically stress-test `OperationsCase`'s lazy get-or-create for
multi-operator concurrency before this audit runs. Same methodology as
`docs/DRIVER-SLICE-2-PRODUCTION-AUDIT.md`: every claim below was checked
against the real codebase and, where a live Postgres was available, exercised
via the actual jest suite — not assumed from a file existing.

**Scope**: DPX-OPS-001 Slice 2 (Operations Work Queues) as it exists in
`apps/backend/src/operations/`, `packages/sdk/src/operations/`, and
`apps/operations-console/src` after the 2026-08-05 filter/concurrency
refinement round (commit `70a2949` plus this round's changes). Slice 1 (Live
Operations Dashboard) is out of scope — already covered by its own shipped
status. Slices 3-4 (Dispatch Management, Analytics) are not yet started and
are explicitly out of scope. **This audit does not authorize a module-level
freeze** — per the founder's own discipline, that happens once all four
Phase 1 slices are built and audited together.

## 1. Unified case lifecycle

`OperationsLifecycleStatus` — `NEW → ASSIGNED → IN_PROGRESS → WAITING →
RESOLVED → CLOSED` — matches the founder's Standard Workflow exactly (6
values, same order). Verified non-linear transitions are permitted (the
service applies whatever `dto.status` is passed, no forward-only guard),
matching the founder's own note that a case can move back to WAITING from
IN_PROGRESS or reopen from RESOLVED — real, tested behavior (`updateCase`
tests in `operations-cases.service.spec.ts` exercise ASSIGNED, RESOLVED, and
CLOSED transitions independently). ✅ Real.

## 2. Assignment / ownership

`OperationsAssigneeRole` is `OPERATOR | SUPERVISOR`, matching the founder's
"Unassigned / Assigned to operator / Assigned to supervisor" model exactly
(unassigned is represented by `assignedToId: null`, not a third enum value —
correct, since "unassigned" is an absence of assignment, not a role).
`getAssignableStaff()` classifies every `operations:queues:manage` holder as
SUPERVISOR if they also hold the `administrator`/`super_administrator` role
name, OPERATOR otherwise — verified by a live-DB test
(`surfaces assignable staff, classifying administrator-role holders as
supervisors`). Assignment stamps `assignedById`/`assignedAt` and, if the case
was still NEW, auto-advances it to ASSIGNED (`updateCase`) — matches the
founder's "Assigned by, Assigned at" tracking requirement. ✅ Real.

## 3. SLA timestamps

Founder's requirement: "record Created, First response, Assignment,
Resolution, Closure." Mapped 1:1 onto `OperationsCase` columns:

| Founder's term | Column             | Set when                                                                                             |
| -------------- | ------------------ | ---------------------------------------------------------------------------------------------------- |
| Created        | `createdAt`        | Row insert (`@default(now())`)                                                                       |
| First response | `firstRespondedAt` | First assignment OR first status change away from NEW — set once, never reset                        |
| Assignment     | `assignedAt`       | Every (re)assignment                                                                                 |
| Resolution     | `resolvedAt`       | First transition to RESOLVED, or to CLOSED if never resolved (closure implies resolution) — set once |
| Closure        | `closedAt`         | First transition to CLOSED — set once                                                                |

`resolvedAt`/`closedAt` are correctly **never cleared on reopen** — verified
by reading `updateCase`'s guard clauses (`existing.resolvedAt === null`
before writing), so a RESOLVED→IN_PROGRESS→RESOLVED cycle doesn't erase the
original resolution timestamp. Live-DB tests cover both the resolve path and
the "closing directly stamps resolvedAt too if unset" path. ✅ Real.

## 4. Immutable event timeline

`OperationsCaseEvent` rows are `create`/`createMany`-only in the service —
grepped every call site in `operations-cases.service.ts` and confirmed no
`update`/`delete` call exists against `operationsCaseEvent` anywhere in the
module. The event types (`CREATED`, `PRIORITY_CHANGED`, `ASSIGNED`,
`UNASSIGNED`, `STATUS_CHANGED`, `NOTE_ADDED`) cover every mutation path the
founder's example format names. Ordered `createdAt asc` on read
(`getCaseDetail`), indexed `(case_id, created_at)` for that exact query
pattern. FK `operations_case_events.case_id → operations_cases.id ON DELETE
CASCADE` — an event can never outlive its case, but nothing in the app layer
ever deletes a case, so this is a schema-integrity backstop, not a live code
path. ✅ Real, and the concurrency fix (§9) closes the one way this could
have silently produced a duplicate `CREATED` entry.

## 5. Source synchronization

`syncSourceStatus()` is the only place the service writes to
`SosAlert`/`IncidentReport`/`DriverSupportTicket`, and it does so
exclusively through each frozen module's own public service method
(`SosAlertService.updateAlert`/`IncidentReportService.updateReport`/
`DriverSupportService.updateTicket`) — never a direct Prisma write to those
tables. Confirmed by grep: zero `prisma.sosAlert.update`/
`prisma.incidentReport.update`/`prisma.driverSupportTicket.update` calls
anywhere in `apps/backend/src/operations/`. Verified live: assigning an SOS
case syncs the alert OPEN→ACKNOWLEDGED; resolving an incident case syncs the
report to RESOLVED; closing a support case syncs the ticket to CLOSED and
also backfills `resolvedAt` if unset (all three exercised by live-DB tests).
✅ Real, one-directional, frozen-module-safe.

## 6. Permissions

Two flat permissions, `operations:queues:read` (view) and
`operations:queues:manage` (mutate), both seeded onto
`operations_staff`/`administrator`/`super_administrator`
(`prisma/seed-data/role-permissions.ts`). Every one of the four operations
controllers carries `@RequirePermissions`:

| Controller                      | Permission                                         |
| ------------------------------- | -------------------------------------------------- |
| `OperationsQueuesController`    | `QUEUES_READ` (class-level)                        |
| `OperationsCasesController`     | `QUEUES_READ` (get), `QUEUES_MANAGE` (update/note) |
| `OperationsDashboardController` | `QUEUES_READ` (class-level)                        |
| `OperationsStaffController`     | `QUEUES_READ` (class-level)                        |

`prisma-foundation.spec.ts`'s permission-seed count (105) includes both —
this suite is part of the standard verification run and passed. ✅ Real,
no gaps.

## 7. Queue counters

Founder's requirement: "Slice 1's dashboard should automatically surface:
Active SOS, Open Incidents, Open Support Tickets, Waiting Reviews without
duplicating backend logic." `OperationsDashboardService.getQueueCounters()`
is a one-line delegate to `OperationsCasesService.getQueueCounters()` —
confirmed by reading the method body, not just its name. That method itself
is four parallel `count()` queries against the real source tables/case
table (`SosAlertStatus.OPEN|ACKNOWLEDGED`, `IncidentReportStatus.OPEN|
ACKNOWLEDGED`, `DriverSupportTicketStatus.OPEN|IN_PROGRESS`,
`OperationsCase.status = WAITING`) — no cached/derived duplicate state. ✅
Real, zero duplicated logic.

## 8. Live Activity Feed

The founder's "one addition." `OperationsDashboardService.getActivityFeed()`
composes six parallel read-only queries (SOS creation, Incident creation,
Inspection completion, Shift start, Shift end, Ride cancellation), merges,
sorts by `occurredAt` desc, caps to `FEED_LIMIT`. Confirmed no new table or
write path was introduced — purely derived. **One honest, documented gap
carried forward unchanged by this round**: driver online/offline transitions
are not in the feed, because `DriverAvailability` only stores current state,
not a history of transitions, and adding one would mean touching frozen
Driver Slice 2 availability-update code. Recorded in the type's own doc
comment (`ActivityFeedEventType` in `packages/types/src/operations/
index.ts`) and in this audit, not silently dropped. ✅ Real, gap honestly
carried.

## 9. Filters — the founder's 2026-08-05 refinement

Founder's Search & Filters list: Status, Priority, Operator, Date, Driver,
Ride, Vehicle, Region.

| Filter   | Status                                                                                                                                                                                                                       |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status   | ✅ Real (all three queues)                                                                                                                                                                                                   |
| Priority | ✅ Real (all three queues)                                                                                                                                                                                                   |
| Operator | ✅ Real — `assignedToId` (all three queues)                                                                                                                                                                                  |
| Driver   | ✅ Real — `driverId` (all three queues, pre-existing since initial ship)                                                                                                                                                     |
| Date     | ✅ Real (new this round) — inclusive `createdAt` range, all three queues                                                                                                                                                     |
| Ride     | ✅ Real (new this round) on SOS + Incident (`SosAlert`/`IncidentReport` both store `rideId`). Support queue correctly returns empty rather than silently ignoring the filter — `DriverSupportTicket` has no ride association |
| Vehicle  | ✅ Real (new this round) on SOS only (`SosAlert` is the only source table with `vehicleId`). Incident/Support correctly return empty                                                                                         |
| Region   | ⚠️ Deliberately deferred — no canonical operational geography/zone model exists yet in DrippleX; founder's explicit instruction not to invent one to satisfy this filter                                                     |

Verified live: 4 new tests in `operations-cases.service.spec.ts`'s "Date/
Ride/Vehicle filters" block — SOS filtered by `rideId`/`vehicleId`
independently, SOS filtered by an inclusive date range (in-range hit,
out-of-range miss), Incident filtered by `rideId` and confirmed empty on
`vehicleId`, Support confirmed empty on both `rideId` and `vehicleId`. All
pass. `operations-console`'s three queue screens each expose only the
filter controls their queue's data can actually satisfy (`QueueFilterBar`'s
`fields` prop) — SOS gets Ride + Vehicle, Incident gets Ride only, Support
gets neither, all three get Date. Region is not present in the UI at all —
not a hidden/disabled control, genuinely absent, matching the backend. ✅
Real, scoped exactly to the founder's decision, no invented capability.

## 10. SDK

`OperationsQueuesClient.getSosQueue/getIncidentQueue/getSupportQueue` each
accept the extended `OperationsQueueQuery` (now including `dateFrom`/
`dateTo`/`rideId`/`vehicleId`), serialized via the existing generic
`toQuery()` helper — no per-field serialization code needed, confirmed by
reading the unchanged `toQuery()` implementation. `OperationsCasesClient`,
`OperationsDashboardClient`, `OperationsStaffClient` unchanged this round.
Package rebuilt (`pnpm --filter @dripplex/sdk run build`) so
operations-console picks up the new query fields — confirmed by a clean
`tsc` pass in operations-console immediately after. All 126 SDK vitest tests
pass (3 new/updated operations-queues-client assertions among them). ✅ Real.

## 11. Operations Console

Three queue-list screens (SOS/Incident/Support) and three case-detail
screens, all reading real SDK data (no mock/seed-data import — grepped every
hook backing these screens for a literal object return, found none). The new
`QueueFilterBar` component applies on explicit submit (not per-keystroke),
avoiding a request storm while an operator is still typing a ride/vehicle
id. Filters are part of each `useQuery`'s query key
(`operationsQueueKeys.sos(filters)` etc.), so each distinct filter
combination gets its own cache entry and its own 15s poll — verified by
reading `use-operations-queues.ts`. Case mutations
(`useUpdateCase`/`useAddCaseNote`) invalidate all filter-combination caches
via the bare `*Prefix` keys (TanStack Query prefix-matching), not just the
one variant currently on screen — this was a real fix made in this round
(the naive approach of invalidating with the old flat key would have missed
every filtered cache entry once filters became part of the key). `next
build` succeeds with all 9 routes still generating (static where possible,
dynamic for `[id]` routes). ✅ Real, no regressions from the filter-key
change.

## 12. Error states

Every queue-list page and every case-detail page handles `isLoading` and
`isError` explicitly (`LoadingSpinner`/`EmptyState`) — grepped for
`isError` across `apps/operations-console/src/app/queues` and
`app/page.tsx`, found it in all 7 files. Mutation error handling
(`onError` callbacks surfacing a toast/inline message) is present in
`case-controls.tsx` (assign/priority/status/unassign, 4 call sites) and
`case-note-form.tsx` (add note). No mutation silently swallows a failure.
✅ Real.

## 13. Database integrity

Migration `20260804230000_add_operations_work_queues` matches
`schema.prisma` exactly (re-verified this round — unchanged, since the
filter/concurrency work needed no schema change). Foreign keys: `assigned_
to_id`/`assigned_by_id`/`actor_id` all `ON DELETE SET NULL` (a case or
event survives the deletion of the staff user who touched it — correct,
preserves the audit trail); `case_id` on `operations_case_events` is `ON
DELETE CASCADE` (an event can never outlive its case). Indexes match every
real query pattern used: `(case_type, status)` for queue summaries,
`priority` for priority filtering, `assigned_to_id` for "my cases" lookups,
the `@@unique(case_type, source_id)` compound index doubling as the
concurrency-safety primitive (§9 below), and `(case_id, created_at)` for
ordered timeline reads. ✅ Real, unchanged, still correct.

## 14. Frozen-module boundaries

Grepped `git diff` from the Slice 2 ship commit (`70a2949`) forward — the
entire filter/concurrency refinement round touched **zero** files under
`apps/backend/src/drivers/sos`, `apps/backend/src/drivers/incidents`,
`apps/backend/src/drivers/support`, and made **zero** changes to
`schema.prisma` or any migration. Every filter this round added reads
columns that already existed on those frozen tables (`SosAlert.rideId`/
`vehicleId`, `IncidentReport.rideId`) — no schema change was needed or made
to close the Ride/Vehicle gap. `IncidentCategory` was explicitly left
untouched per the founder's decision. ✅ Verified, zero frozen-module
edits.

## 15. Concurrency / idempotency of lazy case creation

The founder's specific ask: "test idempotency/concurrency of lazy case
creation so two simultaneous operators or polling requests cannot create
duplicate OperationsCases." This audit found and fixed a real bug here — not
a hypothetical.

**The bug.** The original `ensureCases()` batched a `createMany({
skipDuplicates: true })` for all missing cases, then re-read every case
matching those source ids to log a `CREATED` timeline event for each. Under
a genuine race — two operators (or one operator's UI double-firing a
request) polling the same queue before either has a case row for a
brand-new SOS/incident/support row — both callers' `createMany` calls race;
`skipDuplicates` correctly ensures only one row is ever inserted (backed by
the real `@@unique([caseType, sourceId])` Postgres index, not just Prisma-
level dedup), so the case row itself was never at risk of duplication. But
**both callers' follow-up re-read sees the same winning row**, and both
then log their own `CREATED` event for it — producing a duplicate "Case
created" entry in what's supposed to be an immutable, one-entry-per-fact
timeline. This would not surface in ordinary single-operator UI testing;
it only appears under real concurrent load, exactly as the founder
anticipated.

**The fix.** `ensureCases()` now inserts each missing case individually via
`prisma.operationsCase.create()`, run concurrently via `Promise.all` (not
sequentially — no N+1 regression, this only runs once per genuinely-new
source row, not on every poll). A `create()` that hits the unique-constraint
violation (Postgres error code `P2002`, checked via the same duck-typed
`isUniqueConstraintViolation()` pattern already used in
`ride-rating.service.ts`) means another concurrent call won the race for
that exact case; the loser re-reads the winner's row by its compound unique
key (`caseType_sourceId`) and returns it **without** logging its own
`CREATED` event. Only the actual winner of each individual case's race logs
that case's one `CREATED` event.

**Verification.** Two new live-DB tests in `operations-cases.service.spec.ts`
under "concurrent lazy case creation": a 2-way race and a 5-way race, both
firing `service.getSosQueue({ driverId })` concurrently against the same
brand-new `SosAlert`, both asserting exactly one `OperationsCase` row and
exactly one `CREATED` `OperationsCaseEvent` row afterward. Both pass against
a real Postgres instance (not mocked), which is the only way this class of
bug can actually be exercised — a mocked Prisma client would never surface
a real unique-constraint race. ✅ Fixed, verified, real.

## 16. Regression check

Full suite re-run after the refinement round: 1222 backend jest tests pass
(1 unrelated pre-existing suite-level failure noted below), 126 SDK vitest
tests pass, 1 operations-console vitest test passes, `tsc --noEmit` and
`eslint --max-warnings=0` clean across backend/SDK/operations-console,
`next build` succeeds (9/9 routes). `prisma-foundation.spec.ts` (105
permission seeds) passes.

**One pre-existing, unrelated finding, noted honestly rather than silently
ignored**: `src/auth/services/verification.service.spec.ts` fails only when
run as part of the full jest suite (`TypeError: Cannot read properties of
undefined (reading 'MERCHANT_PORTAL')` — `RegistrationChannel` resolves
`undefined` at that point in the run) but passes cleanly in isolation. This
is a test-order/module-registry interaction between unrelated auth specs,
not caused by this round's changes — the file was not touched this session,
and the failure mode (an enum resolving `undefined` only under full-suite
ordering) is characteristic of a `jest.mock('@prisma/client', ...)` call
elsewhere in the suite leaking across files in the same worker, not a
DPX-OPS-001 defect. Flagged here for whoever next touches auth test
mocking; not investigated further as it's out of this audit's scope and
does not block Slice 2.

## Recommendation

No launch-blocking defects found in DPX-OPS-001 Slice 2 as refined. The one
real defect this audit surfaced (§15, duplicate `CREATED` timeline events
under concurrent lazy case creation) was fixed and verified in the same
pass, not merely catalogued. Filters now cover everything the founder
approved (§9), with Region correctly deferred rather than invented, and the
frozen Driver Slice 2 modules remain completely untouched (§14).

Per the founder's own governance, this audit does **not** authorize a
freeze — Slice 2 stays open pending Founder Review, and the module-level
freeze happens only once Slices 3-4 are built and audited alongside it.

## 🔒 Founder Review — Approved for freeze (2026-08-05)

The founder reviewed this audit's findings and approved Slice 2 for freeze
in full, specifically calling out the concurrency finding (§15): "The
unique case constraint protected the case record, but the duplicate
`CREATED` timeline-event race could have damaged the integrity of the
operational audit trail. Fixing it and testing both 2-way and 5-way
concurrent creation against real Postgres is exactly what I wanted from the
production audit." Freeze boundary from this point: only critical defects/
security fixes, performance improvements, compliance changes, or explicitly
founder-approved enhancements land on Slice 2. This is a **slice-level**
freeze — the module-level freeze for all four Phase 1 slices together still
awaits Slices 3-4. See `docs/DPX-OPS-001-OPERATIONS-COMMAND-CENTRE.md`'s
"🔒 Slice 2 — Founder Approved / Frozen" subsection for the full freeze
record.
