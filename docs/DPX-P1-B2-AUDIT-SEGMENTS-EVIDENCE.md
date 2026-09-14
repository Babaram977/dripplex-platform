# P1-B2 — Audit segments, segment authority, global sequence

**Evidence report.** Supersedes the B2 portion of PR #351.

|                    |                                                                                                                                                                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch             | `claude/p1-b2-audit-segments`                                                                                                                                                                                                             |
| Base               | `main` @ `48e687fd`                                                                                                                                                                                                                       |
| Migrations         | Five files, `20260914090000` – `20260914090400` (see §4a)                                                                                                                                                                                 |
| Scope              | B2 foundation **and segment closure** (historically B4) — see the correction below. No B8.2, no B8.3.                                                                                                                                     |
| Merged             | 2026-09-14 as `c2affb7c`; the five migrations applied to the production database on deploy                                                                                                                                                |
| Production changes | None were made **by the work in this PR**. Merging it applied the migrations above, since Railway runs `prisma migrate deploy` as the backend's `preDeployCommand`. No DNS, Cloudflare, TLS, Worker or domain change. No financial write. |

---

> **Correction, 2026-09-14 — scope.** This PR is described as the B2 foundation.
> It also implements **segment closure**, which the historical decomposition
> assigned to **B4**: `docs/DPX-P1-B2-VERIFICATION.md` on the #351 branch lists
> "Segment closure logic (deferred to P1-B4)" under _What P1-B2 Does NOT
> Implement_. The code is tested, mutation-checked and deployed and is not being
> undone; the record is corrected so nobody opens B4 expecting closure to be
> missing. What remains unimplemented from B4's historical scope is the
> **lifecycle state machine** — every transition beyond `ACTIVE → CLOSED`.
>
> A further correction: `append()` is **P1-B1**, and migrating the existing
> audit writers is **P1-B7**. Section 9 below calls `append()` "the piece
> between B2 and B8", which understates it — both are named increments.
>
> See `docs/DPX-P1-B-SERIES-STATUS.md`, which also records that **no formal
> B-series or Contract 14 specification exists on `main`.**

## 1. Why this is a re-cut and not a rebase of #351

#351 cannot be rebased, and the reason is not the one I first reported.

The stated blocker was a modified copy of an already-applied migration. That is
true, but secondary. The real blocker is that **#351's archive engine stands on
a foundation that never landed**: it reads `auditSegment`,
`segmentArchiveManifest` and `segmentArchivedEvent`, and `main` has none of
those tables, nor `src/audit/archive/`, nor the segment authority. The branch is
66 commits and 23,121 insertions off a merge base far behind `main`, and most of
that is documentation and MKT-INT-001 work `main` has since grown
independently.

So B2 is rebuilt here from the design in #351, onto current `main`, as the first
of three increments.

## 2. A defect in #351's B2 that is deliberately not carried over

#351's B2 included an authoritative-write boundary trigger:

```sql
IF (NEW."segment_id" IS NULL AND NEW."sequence" IS NULL
    AND NEW."hash" IS NULL AND NEW."predecessor_hash" IS NULL) THEN
  RAISE EXCEPTION 'Legacy write boundary violated: ...';
END IF;
```

It rejects exactly the row shape that `AuditService.record()` produces.

**404 call sites in this backend write audit rows through `record()`** — and on
#351's own branch, after its B2 landed, **493 still did.** The branch shipped a
trigger that its own service layer could not satisfy. Applying it to production
would make every audited write throw: campaign enrolment, promoter removal,
payouts, KYC decisions, on a platform taking live money.

The boundary is correct as an eventual goal and wrong as a first step. It lands
with the `append()` path that makes it satisfiable, and with the callers
migrated — not before. This migration is **purely additive**: the four new
columns are nullable, and every existing row satisfies the atomicity CHECK
through its all-NULL branch. A test asserts that a `record()`-shaped write still
succeeds after the migration.

## 3. A correction to #351's closure logic

#351's `closeSegment` reset the stream's `tail_hash` to the genesis value when a
segment closed:

```ts
tailHash: '0000...0000', // Reset to genesis for new segment
```

Closing a segment appends no event, so the tail of the stream has not moved. The
next event must chain to the **last real event**, not to a genesis placeholder.
Resetting it severs the hash chain at every segment boundary while leaving each
segment internally consistent — a break that verifies clean per segment and
fails only across the join, which is the hardest kind to find later.

This implementation leaves `tail_hash` alone on closure, records the
predecessor's real tail as the successor's `predecessorTailHash`, and has a test
named for the property (`leaves the stream tail alone, so the chain survives the
boundary`). Mutation M2 restores #351's behaviour and the test fails.

## 4. What is in this increment

**Migration** — `audit_segments`, `audit_stream_state`, the
`AuditSegmentLifecycle` enum, four nullable columns on `audit_logs`, the
atomicity CHECK, the **global** partial unique index on `sequence`, per-segment
uniqueness, three RESTRICT foreign keys, and the genesis segment and stream row.

**Code**

| File                                                        | Lines | What it is                                                                   |
| ----------------------------------------------------------- | ----- | ---------------------------------------------------------------------------- |
| `src/audit/segment-authority.service.ts`                    | 118   | Allocates the global sequence under `SELECT … FOR UPDATE`; delegates closure |
| `src/audit/repositories/prisma-audit-segment.repository.ts` | 129   | Closure + successor creation + stream move, atomically                       |
| `src/audit/repositories/audit-segment.repository.ts`        | 39    | The contract                                                                 |
| `src/audit/audit.constants.ts`                              | +28   | `STREAM_STATE_ID`, `GENESIS_HASH`, `GENESIS_SEGMENT_ID`                      |
| `src/audit/audit.module.ts`                                 | +12   | Wiring                                                                       |

**Not in this increment, deliberately:** the `append()` path, the hash chain
service, the audit controller, the authoritative-write boundary trigger, and
everything B8 (legal holds, control events, archive manifests, retention
policies, the archive engine).

### 4a. Why five migration files and not one

Merging this PR runs `prisma migrate deploy` against the production database —
Railway invokes it as the backend's `preDeployCommand`. So the shape of the
migration is not a stylistic matter: it is what production experiences.

Written the obvious way, three statements each scan `audit_logs` under
`ACCESS EXCLUSIVE`: the CHECK constraint, the foreign key, and the index
builds. That lock blocks every write to the table for the length of the scan,
and **404 call sites in this backend write audit rows** — so the stall reaches
enrolment, payouts and KYC decisions. The cost is proportional to how large
`audit_logs` has grown, which cannot be read from here.

Split as follows, each step taking a lock that does not block writes:

| Migration | Contains                                                             | Lock                                                     |
| --------- | -------------------------------------------------------------------- | -------------------------------------------------------- |
| `…090000` | Tables, genesis rows, columns, CHECK **NOT VALID**, FK **NOT VALID** | ACCESS EXCLUSIVE, but no scan — brief                    |
| `…090100` | `CREATE UNIQUE INDEX CONCURRENTLY` (global sequence)                 | concurrent build                                         |
| `…090200` | `CREATE INDEX CONCURRENTLY` (segment)                                | concurrent build                                         |
| `…090300` | `CREATE INDEX CONCURRENTLY` (segment, sequence)                      | concurrent build                                         |
| `…090400` | `VALIDATE CONSTRAINT` ×2                                             | SHARE UPDATE EXCLUSIVE — blocks neither reads nor writes |

Two things forced the split, and both were found by running it rather than by
reasoning about it:

1. **`CREATE INDEX CONCURRENTLY` cannot run inside a transaction block**, and
   Prisma wraps any multi-statement migration in one. A first probe appeared to
   show CONCURRENTLY working under `migrate deploy` — it passed only because
   that probe file held a single statement. The real migration failed with
   `SqlState(E25001)`. Hence one index per file.
2. **`NOT VALID` and `VALIDATE` must be in different transactions.** Together in
   one, the `ACCESS EXCLUSIVE` taken by `ADD CONSTRAINT` is held until commit —
   so the validation scan happens under the strong lock anyway, defeating the
   entire purpose.

The end state is identical to the single-file version: both constraints fully
valid (`convalidated = t`), all three indexes valid (`indisvalid = t`), verified
by querying `pg_constraint` and `pg_index` after applying.

The indexes are **partial** (`WHERE … IS NOT NULL`). Every existing row has NULL
in these columns, so a plain index would copy the whole table into an index that
holds nothing useful. Prisma cannot express partial indexes, so they live in the
migration and not in the datamodel — and the bidirectional drift check confirms
Prisma is content with that.

There is deliberately **no** `UNIQUE (segment_id, sequence)`. Global uniqueness
already implies per-segment uniqueness, and a non-partial unique constraint
would have indexed every legacy NULL row — a full-size index on a hot table
bought for nothing.

**Residual risk:** a `CONCURRENTLY` build that fails midway leaves an INVALID
index behind, which must be dropped and rebuilt. It does not block writes and it
does not corrupt data, but it is the one failure mode this shape introduces that
the simple version does not have.

## 5. Test evidence

`src/audit/audit-segments.db.spec.ts` — **16 tests, real PostgreSQL**.

| Group                                | Tests                                                                                                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The migration leaves a usable stream | 2 — one ACTIVE segment and one stream head; **a `record()`-shaped legacy write still succeeds**                                                                                |
| Sequence allocation                  | 4 — allocates head and chain anchor; reserves without writing; **serialises 10 concurrent allocations**; refuses a segment closed underneath it                                |
| Closure                              | 5 — closes and opens successor; **tail survives the boundary**; idempotent for the same reason and refuses a different one; refuses an empty segment; never two ACTIVE or none |
| Database-enforced constraints        | 5 — second ACTIVE refused; many CLOSED coexist; partial authoritative row refused; **same global sequence in two segments refused**; RESTRICT protects evidence                |

**Stability:** 5 consecutive full-suite runs, 16/16 each.

The suite normalises the stream before _and_ after itself. It mutates a
singleton row, so a run that dies halfway would otherwise fail the next run for
reasons unrelated to the code — which happened once while writing it, and the
partial unique index is what caught it.

## 6. Mutation testing

Eight mutations, eight killed. Each file restored and checksum-verified after.

| #   | Mutation                                                     | Result                                                                                    |
| --- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| M1  | Drop `FOR UPDATE` from the allocation lock                   | **5 of 5 runs red** — reported as a ratio, not one run, because it is a concurrency guard |
| M2  | Closure resets the stream tail to genesis (#351's behaviour) | 1 test red                                                                                |
| M3  | Successor restarts the sequence at 1 instead of continuing   | 1 test red                                                                                |
| M4  | Successor does not record its predecessor's tail             | 2 tests red                                                                               |
| M5  | Drop the global unique index on `sequence`                   | 1 test red                                                                                |
| M6  | Drop the authoritative atomicity CHECK                       | 1 test red                                                                                |
| M7  | Drop the one-ACTIVE-segment partial unique index             | 1 test red                                                                                |
| M8  | `audit_logs` segment FK becomes CASCADE instead of RESTRICT  | 1 test red                                                                                |

M5–M8 mutate the migration's own constraints directly in the database, so the
tests are shown to depend on the schema and not merely on application code.

## 7. Migration verification

| Check                                                  | Result                            |
| ------------------------------------------------------ | --------------------------------- |
| `migrate deploy` onto a database at `main`             | Applied cleanly                   |
| `migrate diff --from-migrations --to-schema-datamodel` | **No difference detected**        |
| `migrate diff --from-url <live db> --to-migrations`    | **No difference detected**        |
| `migrate status`                                       | 143 migrations, schema up to date |

The first drift check initially reported three changed foreign keys: the
migration named one constraint differently from Prisma's convention and omitted
`ON UPDATE CASCADE` on all three. Both were corrected, the migration was rolled
back and re-applied, and the check now passes in both directions. A migration
that disagrees with its own schema is a merge-time surprise for whoever adds the
next one.

## 8. Gate results

| Gate                                 | Result                                                                                   |
| ------------------------------------ | ---------------------------------------------------------------------------------------- |
| Backend tests, real Postgres + Redis | **313 suites / 3,297 tests** pass                                                        |
| Monorepo typecheck                   | 19/19                                                                                    |
| Monorepo lint                        | 18/18                                                                                    |
| Monorepo build                       | 12/12                                                                                    |
| Audit module lint                    | clean (two findings fixed: an unnecessary `BigInt()` conversion and nine `return-await`) |

## 9. What comes next, and what must be true first

**B8.2** — legal holds, control events, archive manifests, retention policies.
**B8.3** — the archive engine, six-part verification, immutable archived events.

Between B2 and B8 sits the piece neither increment contains: the `append()`
path and the hash-chain service, and the migration of 404 call sites onto it.
Until that exists, `audit_segments` is a correct, verified, and entirely unused
foundation — and the authoritative-write boundary cannot be installed.

That is the honest state: this PR builds the floor, not the building.
