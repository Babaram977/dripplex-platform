# DPX-P1-B8 — Unblock Decision Matrix

**Status: DECISION SUPPORT. No code changes. B8 remains HOLD 🔴.**

Companion to `DPX-P1-B8-CLASS-A-AUDIT-WRITE-INVENTORY.md` (`246bdc0`). Measured on
`b8-sync` @ `002feaf`; remote B8 `a152a25` and PR #351 untouched.

---

## Population, restated correctly

The 486 lint violations and the migration population are **not** the same set:

| | Count |
| --- | --- |
| Lint violations (what CI sees) | 486 |
| — production `AuditService.record()` | **361** ← the actionable population |
| — spec-file occurrences | 125 (123 `record()` + 2 `create()`) |
| Production `PrismaAuditLogRepository.create()` callers | **0** |

The migration population is **361 production `record()` call sites**, not 486. Those sit in
**299 distinct methods** across **77 files** in **30 domains** — 299 audited operations is the
truer unit of work, since a method with three audit calls needs one transaction decision, not
three.

**Test re-verification surface:** 66 spec files exercise a real database; **52** of those
import a service that audits.

---

## One option is now excluded by ruling

A transaction-aware `AuditService` that opens its own transaction when a caller supplies none
would clear the trigger and the lint rule at one file's cost. **It is excluded**, and rightly:
the audit would still commit separately from the business mutation, so the Class-A boundary
would be satisfied in form while the old failure semantics survived underneath. It is recorded
here only so the matrix is not read as having overlooked the cheapest path — it is cheap
precisely because it does not do the work.

---

## The matrix

| | **A — Big-bang migration** | **B — Incremental migration** | **C — Phased enforcement** | **D — Hold B8** |
| --- | --- | --- | --- | --- |
| **Shape** | Migrate all 361 sites, then deploy B8 whole | Same endpoint, staged over releases; B8 stays unmerged throughout | Deploy B8 with enforcement deferred; migrate; then enable the trigger | Do nothing to B8 until the platform migration lands independently |
| **Production files / callers** | 77 files, 299 methods, 361 sites | Same total, spread over N releases | Same total, but off B8's critical path | 0 now; same total later |
| **Atomicity delivered** | **Full** — audit commits with the mutation | **Full, but only for migrated sites**; unmigrated sites keep old semantics | **Full at the end state**; none during the window | Full, eventually |
| **Transaction-boundary changes** | 299 methods; 253 sites need a transaction created where none exists, 108 need the audit moved inside an existing one | Identical work, sequenced | Identical work, but decoupled from B8's release | Identical work |
| **Failure semantics** | Changes at every audited operation on one date: a failed audit newly aborts the payment, ride or KYC decision | Changes per site as migrated — a long period where two semantics coexist | Unchanged during the window, then changes at enable time | Unchanged until the migration lands |
| **Migration risk** | **Highest.** One release alters failure behaviour across 30 domains; blast radius is the platform | **Medium.** Smaller blasts, but a long mixed-semantics period and 361 chances to stall midway | **Medium-low.** B8's own risk is isolated from the platform migration's; each can fail independently | **Lowest technical risk, highest schedule cost** |
| **Rollback** | Revert the release. Wide but atomic — one revert restores old semantics everywhere | Revert the individual slice. Cheapest per-step rollback of the four | Two independent rollbacks: revert B8, or drop the trigger again. Enabling the trigger is itself a one-statement revert | Nothing to roll back |
| **B8 trigger intact?** | **Yes**, unchanged | **Yes**, unchanged — and it is what blocks every unmigrated site | **Yes as the end state.** Deferred by an additive migration that drops it, re-created by another at the end. B8's existing migration files are not edited | **Yes**, unchanged |
| **Independently deployable?** | No — B8 and the migration must ship together | No — B8 cannot merge until the last site is migrated | **Yes** — B8's models, archive engine and verifier deploy immediately; the migration proceeds on its own schedule | No — B8 does not deploy at all |
| **Implementation scope** | 299 methods, one coordinated release | 299 methods across many releases, plus per-release coordination | 2 additive migrations (~10 lines total) + the same 299 methods later | 0 now |
| **Testing scope** | 52 real-DB specs re-verified at once, plus the 22 known-failing | 52 specs re-verified incrementally | 52 specs unaffected until enable time; B8's own 9 suites verified now | Unchanged |

---

## Why C is mechanically cheaper than it sounds

`20260905_p1_b2_authoritative_boundary_and_global_sequence` contains exactly four statements:

1. `CREATE UNIQUE INDEX audit_logs_sequence_global_key` — the partial index B8's sequencing
   depends on
2. `CREATE OR REPLACE FUNCTION audit_logs_authoritative_boundary_check()`
3. `DROP TRIGGER IF EXISTS …`
4. `CREATE TRIGGER …`

**The enforcement (2–4) is cleanly separable from the index (1).** Deferring it needs no edit
to any existing B8 migration — only a new additive migration that drops the trigger, and a
second one at the end of the platform migration that re-creates it. B8's history stays intact
and reviewable.

Nothing in B8's own function depends on the trigger. `append()` still writes all four
authoritative fields; the partial unique index still enforces global sequence uniqueness; the
archive engine and six-part verifier operate on rows that carry the fields. The trigger
enforces that *nobody else* writes legacy rows — which is precisely the property the platform
cannot yet satisfy.

---

## Recommendation: C, phased enforcement

**Deploy B8 with enforcement deferred, migrate the platform as its own workstream, then enable
the trigger as that workstream's final step.**

Reasons, in order of weight:

1. **It is the only option that separates two genuinely independent risks.** B8's archive
   engine either works or it does not; the platform's transaction boundaries are a separate
   question. A and D bind them together — A ships both risks at once, D holds a working
   feature hostage to unrelated work.
2. **It preserves the contract as the end state.** This is not option "weaken the trigger".
   The trigger returns, unchanged, at the end. The only thing deferred is *when* enforcement
   starts, and B8's own migration comment already assumes a clean cut — this simply makes the
   cut explicit and scheduled rather than implicit and immediate.
3. **It costs about ten lines of additive SQL**, with no edit to B8's existing migrations and
   a one-statement rollback in either direction.
4. **It lets the 361-site migration be done well.** Under A it is a deadline; under C it is a
   workstream that can proceed domain by domain with its own review, which matters when the
   change alters failure semantics for payments and KYC.

**What it does not do, stated plainly:** during the window, audit writes remain
non-authoritative for every unmigrated caller. B8's models exist and its archive engine runs,
but the platform is not yet Class-A. Anyone reading "B8 deployed" as "authoritative audit
achieved" would be wrong, and the window should be visible in whatever tracks launch
readiness rather than buried in a migration.

**If that window is unacceptable**, D is the honest alternative — hold B8 until the platform
is migrated. A and B both look like progress while carrying materially worse risk: A changes
failure semantics platform-wide in a single release, and B leaves two audit semantics
coexisting for as long as the migration takes, which is the hardest state to reason about
during an incident.

---

## What this does not settle

- **Whether the atomicity change is wanted at all.** The migration's end state is that a
  failed audit write aborts the business mutation. That is defensible for an authoritative
  audit and it is a product decision, not an engineering one. It should be ruled on before the
  361-site workstream starts, because it determines whether the work is worth doing.
- **Per-caller behaviour when a transaction cannot be created.** Not derivable from the code,
  because no caller creates one today.
- **The 108 category-3 sites specifically.** Moving an audit inside an already-existing
  transaction changes that operation's atomicity most directly, and those 19 files deserve
  review before the 58 standalone ones.
