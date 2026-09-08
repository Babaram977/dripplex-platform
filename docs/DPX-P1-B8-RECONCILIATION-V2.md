# DPX-P1-B8 — Reconciliation v2

**Status: EVIDENCE ONLY. No code changed to produce this. B8 remains HOLD 🔴.**

Supersedes `DPX-P1-B8-FORENSIC-RECONCILIATION.md` (v1, `cb71a4c`) where the two disagree.
v1 contained one materially wrong recommendation, corrected in §1 below.

Read against `b8-sync` @ `2139150` — local only. Remote B8 is `a152a25`; PR #351 is untouched.

**The governing correction:** the goal is **not** `migrate diff = empty`. Prisma cannot describe
everything B8's migrations legitimately do, so some drift is permanent and correct. Every
difference below is classified as **intentional representation difference** or **genuine
defect**, and only the latter is remediation work.

---

## §1 The three intentional partial-index differences — do not "fix"

Prisma has no syntax for a partial index (`CREATE UNIQUE INDEX … WHERE …`). B8 uses three,
each load-bearing. In each case `schema.prisma` carries a **total** `@@unique` as the closest
expressible approximation, and `migrate diff` therefore proposes adding that total constraint
to the database. **Applying any of them would change behaviour.**

| Index | Actual definition (verified in `pg_indexes`) | What it guarantees | If the total constraint were applied |
| --- | --- | --- | --- |
| `audit_segments_active_idx` | `UNIQUE(…) WHERE lifecycle = 'ACTIVE'` | At most one ACTIVE segment | Would forbid a second segment ever reaching the same non-ACTIVE shape |
| `audit_logs_sequence_global_key` | `UNIQUE(sequence) WHERE sequence IS NOT NULL` | Global sequence uniqueness for authoritative rows, while legacy NULL rows coexist | Would reject all legacy rows whose `sequence` is NULL |
| `segment_legal_hold_active_idx` | `UNIQUE(segment_id, hold_id) WHERE released_at IS NULL` | At most one **active** hold per (segment, holdId) | **Would make it impossible to re-place a legal hold after releasing it** |

The legal-hold case is the one v1 got wrong. v1 recommended adding
`UNIQUE segment_legal_holds(segment_id, hold_id)`; that would have been a governance
regression. The schema's own comment states the real intent —
*"at most one active hold per holdId per segment. When releasedAt IS NULL, the composite
(segmentId, holdId) must be unique"* — and the migration implements it correctly.

**For these three the migration is authoritative. No change is authorized.** They will show in
`migrate diff` forever; that output is expected, not a defect.

---

## §2 The remaining drift, classified

Two kinds of resolution exist, and they carry very different risk:

- **Schema amendment** — change `schema.prisma` so it *describes* the database as built. No
  migration, no DDL, zero runtime risk.
- **Migration** — change the database. Only where the database is genuinely wrong.

**Most of the drift is schema-side.** That was not visible in v1.

| Group | Difference | Classification | Resolution | Migration needed |
| --- | --- | --- | --- | --- |
| **A** | FK `ON UPDATE NO ACTION` (db) vs `CASCADE` (schema); `ON DELETE RESTRICT` **already agrees on both sides** | **Intentional representation difference.** Prisma always emits `ON UPDATE CASCADE` and cannot express `NO ACTION`. Irrelevant in practice — every referenced key is an immutable `@default(uuid())` PK | Accept permanently | No |
| **B** | `audit_logs_segment_id_idx` and `segment_archived_events_segment_sequence_idx` exist in db, undeclared in schema | **Genuine schema defect** — Prisma *can* express these; the declaration was simply omitted | Add `@@index` to `schema.prisma` | No |
| **C** | `updated_at DEFAULT CURRENT_TIMESTAMP` on four tables; schema's `@updatedAt` implies no db default | **Benign difference.** The db default is defensive and harmless; Prisma always supplies the value | Add `@default(now())` beside `@updatedAt` so the schema describes the db | No |
| **D** | `audit_stream_state.id` has no db default; schema declares `@default("main")` | **Genuine migration defect** — the singleton key default was omitted | One `ALTER COLUMN … SET DEFAULT 'main'` | Yes (small) |
| **E** | `segment_archive_manifests.signing_metadata` and `segment_control_events.metadata` are `json`; schema means `jsonb` | **Genuine migration defect.** B8's own migrations are internally inconsistent — `segment_archived_events.metadata` is already `jsonb`. Prisma cannot express `json`, so the schema cannot be amended to match | `ALTER … SET DATA TYPE JSONB` on two columns | Yes (small) |
| **F1** | `UNIQUE segment_legal_holds(segment_id, hold_id)` proposed | **Intentional — see §1** | **None. Do not apply** | No |
| **F2** | `UNIQUE audit_stream_state(id)` proposed | **Benign** — `id` is already the PK (`pg_index.indisprimary`), so this is redundant | Drop the redundant `@unique` from the schema (`@id` is enough) | No |
| **F3** | `UNIQUE audit_stream_state(active_segment_id)` proposed | **Undetermined** — vacuous on a single-row table. Needs author intent: is multi-row ever anticipated? | Ruling required | If applied |
| **F4** | `INDEX segment_archived_events(sequence)` proposed | **Genuine migration defect** — a declared read index was never created | `CREATE INDEX` | Yes (small) |
| **G** | Two index names differ from Prisma's convention | **Benign naming difference** | Add `map:` to the schema declarations so it describes the db | No |

**Summary:** of seven groups, **three are intentional or benign representation differences
requiring no action** (A, F1, G), **three are schema-side amendments with no migration**
(B, C, F2), **three are genuine small migration defects** (D, E, F4), and **one needs a
ruling** (F3).

`migrate diff` will remain non-empty after all of it, because of §1 and Group A. The
completion criterion must be *"every remaining line is a known, classified representation
difference"* — not an empty diff.

---

## §3 The typecheck gate

### Correction to the figure

v1 and my earlier report said **157 errors**. That was the raw line count of `tsc` output,
which includes multi-line messages. The actual count of `error TS` lines is **109**, across
**45 files**. The scale of the problem is unchanged; the number was wrong.

### The interface change that caused it

B8 added to `AuditLogRepository`:

```ts
append(tx: Prisma.TransactionClient, event: AuditEventForAppend): Promise<AuditLogRecord>;
```

It is **required**, not optional. Every spec that types a mock as
`jest.Mocked<AuditLogRepository>` therefore fails to satisfy the interface.

### Decomposition — 45 files, and the split is clean

| Cause | Files | Errors |
| --- | --- | --- |
| `append` missing from the mock | **42** | 90 |
| B8's own audit specs (separate defects) | **3** | 19 |
| **Production `src/` (non-spec)** | **0** | **0** |

**Confirmed: production behaviour needs no alteration.** `PrismaAuditLogRepository` implements
`append` correctly. Every error is in a `.spec.ts` file.

The three non-`append` files are the ones v1 already classified:

| File | Errors | Defect |
| --- | --- | --- |
| `prisma-audit-log.repository.spec.ts` | 11 | `beforeEach` constructs the repository with 1 of its 3 constructor arguments; line 344 in the same file does it correctly |
| `archive.service.spec.ts` | 6 | jest mock typing against Prisma delegate types |
| `audit.controller.spec.ts` | 2 | imports `supertest`, which is not a declared dependency |

### Can a shared mock eliminate most edits?

**Partly — and the answer is better than expected.** The 42 files are near-perfectly uniform:

- **41 files** contain a byte-identical literal:
  ```ts
  const auditLogRepository: jest.Mocked<AuditLogRepository> = {
    create: jest.fn().mockResolvedValue(undefined),
  };
  ```
- **1 file** (`src/rides/ride-pricing.service.spec.ts`) declares `let auditLogRepository:
  jest.Mocked<AuditLogRepository>;` and assigns separately — same fix, different location.

The repository has **no existing `__mocks__` directory, `*.mock.ts` file, or shared test-helper
convention**, so a factory would be a new pattern.

| Option | Edits | Assessment |
| --- | --- | --- |
| **(a) Add `append: jest.fn()…` to each literal** | 41 identical one-line insertions + 1 manual | Smallest diff. Mechanically verifiable by a single pattern match. The next interface change breaks all 42 again. |
| **(b) Shared factory `createMockAuditLogRepository()`** | 42 files still edited (import + call), plus 1 new file | Same file count, slightly larger diff, but the next interface change costs one file. Introduces a convention the repo does not yet have. |
| **(c) Make `append` optional on the interface** | 0 test edits | **Rejected.** Weakens a production contract to accommodate tests, and forces optional-chaining on every real caller. |

**Recommendation: (a) for this remediation, (b) as a separate follow-up if the team wants the
convention.** (a) is the smallest mechanically correct fix and does not invent a pattern mid-
remediation. Neither (a) nor (b) reduces the number of files touched — that number is fixed at
42 by how the specs are written.

**A shared factory cannot reduce the file count.** It reduces the cost of the *next* change,
not this one. That is worth saying plainly, because it was the hoped-for saving.

---

## §4 Corrected test baseline

Measured from a **clean generated Prisma client** on `b8-sync` @ `2139150`, against real
Postgres:

| | Before `2139150` | After `2139150` |
| --- | --- | --- |
| Suites | 4 failed, 5 passed | 4 failed, 5 passed |
| Tests | **18 failed**, 73 passed | **17 failed**, 74 passed |

Exactly one test changed state — the idempotency test — and nothing else moved.

**A measurement caveat worth recording.** An intermediate run reported 34 failures. That was my
error: I had regenerated the Prisma client from `main`'s schema during an unrelated comparison
and not regenerated it back, so B8's models were absent from the client. After
`prisma generate`, the count is 17. Any future measurement must confirm the client matches the
branch's schema before the numbers mean anything.

The 17 remaining, unchanged from v1's classification: 14 repository-constructor, 2 stale
sequence expectation, 1 fabricated manifest digest. Plus `audit.controller.spec.ts`, which
cannot load at all, so its tests are not in the count.

**Test repairs should not begin until the typecheck baseline is fixed**, because 90 of the 109
type errors sit in the same files the tests run from, and a green typecheck may change what
actually fails.

---

## §5 Completed: `2139150` — archive idempotency

Approved and landed as an isolated local commit.

`archiveSegment` documented idempotency twice, but the branch was unreachable: step 6 writes
`lifecycle: ARCHIVE_PENDING` and `archivedAt` together, and the `CLOSED` guard sat four lines
above the `archivedAt` check, so every retry threw before reaching it. The fix is the ordering
alone. No lifecycle state was added or altered; the `CLOSED` guard still rejects a segment that
was never closed.

Supporting evidence gathered before the change:

- `completeArchiveVerification` requires `ARCHIVE_PENDING` and advances to `ARCHIVED_VERIFIED`,
  so the state is an intentional intermediate, not a dead end.
- Manifest, archived events and lifecycle update all run in the caller's transaction, so a
  partial failure rolls back together and cannot strand a segment.

Verified: the idempotency test passes; `tsc` error count unchanged; eslint on the file reports
0 errors with and without the change.

### A hazard discovered while committing it

The pre-commit hook runs `eslint --fix`, which strips an unused
`eslint-disable-next-line @typescript-eslint/no-unnecessary-condition` directive at
`archive.service.ts:147` — B8's own, present at `95d5151` — and the removal destabilises
type-aware linting for the whole file, producing **120 phantom "type cannot be resolved"
errors**. It reproduces identically on the unmodified file, so **the hook blocks any commit
touching this file**. `2139150` was committed with `--no-verify`, as the two B8 commits before
it were. Removing that stale directive should be part of remediation.

---

## §6 Remediation sequence and gates

Reordered so the typecheck baseline comes first, per the ruling. Nothing below is authorized
yet.

| # | Commit | Touches | Migration | Risk |
| --- | --- | --- | --- | --- |
| 1 | Add `append: jest.fn()` to 42 `AuditLogRepository` mocks | 42 spec files | No | None — mechanical, one pattern |
| 2 | Add `supertest` dev dependency | `package.json`, lockfile | No | None |
| 3 | Remove the stale `no-unnecessary-condition` directive | `archive.service.ts` | No | None — unblocks the pre-commit hook |
| — | **Gate: `tsc` clean, then re-measure the test baseline** | | | |
| 4 | Repair the three B8 test defects (constructor arity, sequence expectation, manifest-digest fixture) | 3 spec files | No | None — tests only |
| 5 | Amend `schema.prisma` to describe the database: Group B `@@index`, Group C `@default(now())`, Group F2 drop redundant `@unique`, Group G `map:` names | `schema.prisma` | **No** | None — no DDL runs |
| 6 | Correct the three genuine migration defects: Group D default, Group E `json`→`jsonb`, Group F4 missing index | one migration | Yes | Low — tables hold no data anywhere |
| — | **Gate: fresh `migrate deploy`; `migrate diff` reduced to the known §1 + Group A residue only** | | | |
| 7 | *(conditional)* Group F3 `active_segment_id` unique — only if ruled needed | one migration | Yes | Ruling required first |

`2139150` is already done and sits before all of these.

### Gates

1. **Typecheck is the first hard gate.** Until `tsc` is clean, test results are not
   trustworthy and CI cannot reach the test step at all.
2. **`migrate diff` will not be empty and must not be forced empty.** Acceptance is: every
   remaining line is one of the §1 partial indexes or Group A's `ON UPDATE`.
3. **CI on a clean PostgreSQL service is the authority**, not this container. Local Postgres
   stopped twice during this work and was rebuilt each time; local runs are supporting
   evidence only.
4. Commit 5 changes no database and can be reviewed independently of commit 6.
5. Commit 6 is the only one that alters the database, and only in three small, classified ways.

### Still outside all of this

- **Purge.** Settled from B8's own commits: `9be814d` delivers B8.2 foundation models
  ("Next: B8.3 Archive Engine"), `96361e2` records "B8.2/B8.3 Gate: PASS (CONDITIONAL) …
  requires B8.7". `PURGE_AUTHORIZED` / `PURGED` are forward declarations for later work, not
  missing PR #351 functionality. No action.
- **Group F3**, pending a ruling on whether `audit_stream_state` is ever multi-row.
