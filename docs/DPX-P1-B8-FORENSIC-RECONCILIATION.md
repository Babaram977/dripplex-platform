# DPX-P1-B8 — Forensic Reconciliation of the Drift and Test Failures

**Status: EVIDENCE ONLY. No code changed to produce this. B8 remains HOLD.**

Answers the five questions on the two unresolved B8 blockers:

- **(3)** 97 lines of schema/migration drift across nine tables
- **(4)** 18 failing tests plus one suite that cannot load

Read against `b8-sync` @ `95d5151` (merge `0b621d5` + the two migration fixes), which is
local and unpushed. Every claim below is from the migration-produced database, the source, or
git — nothing is inferred from a report.

**Nothing here makes B8 deployable.** Both blockers remain open.

---

## Method

The drift was produced by `prisma migrate diff --from-migrations --to-schema-datamodel`, so
each statement describes **what would have to change in the migration-produced database to
match `schema.prisma`**. Ground truth for "what the migrations actually produce" was taken by
querying the database those migrations built (`pg_constraint`, `pg_indexes`,
`information_schema.columns`), not by reading the SQL.

---

## (1) & (2) The 97 drift lines: which side is intended, and which artifact is authoritative

The 97 lines are six groups, not 97 independent decisions.

### Group A — Foreign keys: `ON UPDATE` only (9 drops + 9 adds, ~36 lines)

|                    |                                             |
| ------------------ | ------------------------------------------- |
| Migrations produce | `ON UPDATE NO ACTION`, `ON DELETE RESTRICT` |
| Schema declares    | `ON UPDATE CASCADE`, `ON DELETE RESTRICT`   |
| **Authoritative**  | **`schema.prisma`**                         |
| Behaviour change   | **None in practice**                        |

**The semantically important half already agrees.** Every one of the nine foreign keys is
`ON DELETE RESTRICT` on both sides — queried directly from `pg_constraint`:

```
audit_logs_segment_id_fkey                    NO ACTION | RESTRICT
audit_segments_predecessor_fkey               NO ACTION | RESTRICT
audit_stream_state_active_segment_id_fkey     NO ACTION | RESTRICT
segment_archive_manifests_segment_id_fkey     NO ACTION | RESTRICT
segment_archived_events_archive_id_fkey       NO ACTION | RESTRICT
segment_archived_events_segment_id_fkey       NO ACTION | RESTRICT
segment_control_events_segment_id_fkey        NO ACTION | RESTRICT
segment_legal_hold_releases_segment_id_fkey   NO ACTION | RESTRICT
segment_legal_holds_segment_id_fkey           NO ACTION | RESTRICT
```

The migrations state `ON DELETE RESTRICT` explicitly, under the comment _"Foreign keys with
ON DELETE RESTRICT (prevent orphaning evidence)"_ — so B8's evidence-preservation intent is
already enforced by the database and is **not** at risk from this drift.

`ON UPDATE` differs only because the migrations omit the clause (Postgres defaults to
`NO ACTION`) while Prisma emits `CASCADE`. It changes behaviour only if a referenced primary
key value is ever `UPDATE`d. All of these reference `audit_segments.id`, a
`@default(uuid())` primary key that nothing in the codebase updates. The same
`ON UPDATE CASCADE` appears on pre-existing non-B8 keys in the same table
(`audit_logs_user_id_fkey` is `CASCADE | SET NULL`), so aligning to the schema also aligns
B8 with the rest of the repository.

One of the nine is additionally a **rename**: `audit_segments_predecessor_fkey` →
`audit_segments_predecessor_segment_id_fkey`. Cosmetic; Prisma's naming convention.

### Group B — Two indexes the migrations create and the schema does not declare (~6 lines)

```
DROP INDEX "audit_logs_segment_id_idx";
DROP INDEX "segment_archived_events_segment_sequence_idx";
```

|                   |                                                                             |
| ----------------- | --------------------------------------------------------------------------- |
| **Authoritative** | **Needs a ruling — this is the one group where the migration may be right** |
| Behaviour change  | Read performance only; no correctness effect                                |

These are the only two items where following the schema **removes** something B8 deliberately
built. `audit_logs` already has `audit_logs_segment_id_sequence_idx` and
`audit_logs_segment_id_sequence_key`, so the single-column index is likely redundant with the
composite — but "likely" is not evidence, and dropping an index someone added on purpose is a
decision, not a normalisation.

**Recommendation: add these two to `schema.prisma` as `@@index`** rather than dropping them
from the database, unless the author confirms they were redundant. That resolves the drift in
the direction that loses nothing.

### Group C — `updated_at` database defaults (4 tables, ~8 lines)

|                    |                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Migrations produce | `DEFAULT CURRENT_TIMESTAMP` on `audit_segments`, `audit_stream_state`, `segment_legal_holds`, `segment_retention_policies` |
| Schema declares    | `@updatedAt` — maintained by the Prisma client, no database default                                                        |
| **Authoritative**  | **`schema.prisma`**                                                                                                        |
| Behaviour change   | Only for a raw-SQL `INSERT` that omits `updated_at`, which would then fail `NOT NULL`                                      |

Nothing in B8 inserts into these tables by raw SQL — all writes go through Prisma, which
always supplies the value. Low risk, but it is a real difference and should be applied
knowingly rather than absorbed.

### Group D — `audit_stream_state.id` default (~2 lines)

|                    |                                     |
| ------------------ | ----------------------------------- |
| Migrations produce | `character varying`, **no default** |
| Schema declares    | `@default("main")`                  |
| **Authoritative**  | **`schema.prisma`**                 |
| Behaviour change   | **Yes, and in the schema's favour** |

`audit_stream_state` is a singleton row keyed `'main'`. Without the default, every insert must
name the id explicitly; with it, the singleton is created correctly by construction. This is
the clearest case where the schema is right and the migration is simply missing something.

### Group E — `JSON` → `JSONB` (2 columns, ~6 lines)

|                    |                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| Migrations produce | `segment_archive_manifests.signing_metadata` = `json`, `segment_control_events.metadata` = `json` |
| Schema declares    | `Json`, which Prisma maps to `jsonb`                                                              |
| **Authoritative**  | **`schema.prisma`**                                                                               |
| Behaviour change   | **None today**                                                                                    |

Two independent pieces of evidence:

1. **B8's own migrations are internally inconsistent.** `segment_archived_events.metadata` is
   **already `jsonb`** (with `DEFAULT '{}'::jsonb`), while `segment_control_events.metadata` is
   `json`. Two sibling metadata columns in the same feature, two types. The `json` spellings
   read as oversights, not intent.
2. **Hash integrity is unaffected.** The concern with `jsonb` is that it reorders keys and
   drops insignificant whitespace, which would matter if a stored value were re-serialised and
   hashed. It is not: `AuditChainService.canonicalizeEvent` builds the canonical string **in
   TypeScript from the in-memory object, before the write**, so the column's storage form never
   enters the hash chain. Separately, `signingMetadata` is written as `null` everywhere in the
   current code (`archive-manifest.builder.ts:110`), so the column holds no non-null value to
   convert.

### Group F — Four constraints the schema declares and the migrations never create (~10 lines)

| Constraint                                        | Effect if applied                                                                  | Assessment                                       |
| ------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------ |
| `UNIQUE segment_legal_holds(segment_id, hold_id)` | **Correctness** — prevents duplicate legal holds on one segment                    | The database does **not** currently enforce this |
| `UNIQUE audit_stream_state(active_segment_id)`    | **Correctness** — one stream-state row per active segment                          | Not currently enforced                           |
| `UNIQUE audit_stream_state(id)`                   | Redundant — `id` is already the primary key (verified via `pg_index.indisprimary`) | Harmless no-op                                   |
| `INDEX segment_archived_events(sequence)`         | Read performance                                                                   | No correctness effect                            |

|                   |                                          |
| ----------------- | ---------------------------------------- |
| **Authoritative** | **`schema.prisma`**                      |
| Behaviour change  | **Yes — this is the group that matters** |

**This is the most significant finding in (3).** Two uniqueness rules that B8's own data model
declares are not enforced by the database B8's migrations build. Until they are, duplicate
legal holds and duplicate active-segment stream rows are insertable. Applying them is a
tightening, so it can fail against existing data — though these tables have never been
deployed anywhere, so there is no existing data to conflict.

### Group G — Two index renames (~4 lines)

`segment_archived_events_unique_segment_sequence` → `..._segment_id_sequence_key`, and
`segment_control_event_sequence_key` → `segment_control_events_sequence_key`. Naming only;
no behaviour either way.

### Summary of (1)–(3)

| Group                     | Lines | Authoritative           | Alters B8 behaviour?                                        |
| ------------------------- | ----- | ----------------------- | ----------------------------------------------------------- |
| A — FK `ON UPDATE`        | ~36   | schema                  | No (UUID PKs are never updated); `ON DELETE` already agrees |
| B — 2 extra indexes       | ~6    | **migration, probably** | No — performance only                                       |
| C — `updated_at` defaults | ~8    | schema                  | Only for raw-SQL inserts, of which there are none           |
| D — `id` default `'main'` | ~2    | schema                  | Yes, favourably                                             |
| E — `JSON` → `JSONB`      | ~6    | schema                  | No — hashing is done in TypeScript; column is always null   |
| F — 4 missing constraints | ~10   | schema                  | **Yes — two real uniqueness rules are unenforced**          |
| G — index renames         | ~4    | either                  | No                                                          |

`schema.prisma` is authoritative for every group except **B**, where the migration adds two
indexes the schema forgot to declare.

---

## (4) The 18 failing tests

### Do any of them postdate the synchronization? No — all predate it.

Two independent proofs:

- `git diff origin/claude/p1-b8-archive-purge-6o3vb8 -- apps/backend/src/audit` is **empty**:
  the merge left `src/audit` byte-identical to B8.
- `git diff f48fe32 origin/main -- apps/backend/src/audit` is **empty**: main never touched
  `src/audit` after the merge base, so the merge had nothing to bring in.

No failure can have been introduced by the synchronization.

### Classification

| Failures    | File                                                | Class                                                       | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------- | --------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **14**      | `prisma-audit-log.repository.spec.ts`               | **Test/setup defect**                                       | Line 34 constructs `new PrismaAuditLogRepository(mockPrismaService as any)` with **one** argument; the constructor takes **three** (`prisma`, `segmentAuthorityService`, `auditChainService`). Line 344 **in the same file** constructs it correctly with all three. The `beforeEach` was never updated when P1-B2 added the two dependencies. Every failure is the same `TypeError: Cannot read properties of undefined (reading 'allocateSequenceAndObtainTail')`. |
| **2**       | `audit-chain.service.spec.ts`                       | **Test defect — stale expectation**                         | Test asserts `parsed.sequence` is the number `1001`; the implementation emits the string `"1001"`. The implementation is deliberate and says so: _"CRITICAL: sequence must be preserved as exact decimal string, not converted to Number, to avoid precision loss for values > 2^53-1"_. The test still encodes the superseded `// BigInt → number` behaviour.                                                                                                       |
| **1**       | `archive.service.spec.ts` — post-purge verification | **Test fixture defect**                                     | The fixture sets `manifestDigest: 'd'.repeat(64)`, an arbitrary value. `SixPartVerifier` Part 6 recalculates the digest and compares (`if (recalculated !== input.manifestDigest)`), so a fabricated digest can never verify. The fixture cannot satisfy the check it is asserting against.                                                                                                                                                                          |
| **1**       | `archive.service.spec.ts` — idempotency             | **Candidate implementation defect — needs a design ruling** | See below.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **1 suite** | `audit.controller.spec.ts`                          | **Dependency/configuration defect**                         | `import * as request from 'supertest'` — `supertest` is not declared in `apps/backend/package.json` or the root manifest. The suite cannot load, so its tests never run and are not counted in the 18.                                                                                                                                                                                                                                                               |

### The one that is not a test defect

```
Segment must be CLOSED to archive, got ARCHIVE_PENDING
    at ArchiveService.archiveSegment (archive.service.ts:72)
```

The test _"should return same manifest on retry with same segmentId"_ archives a segment
twice. The first call moves the segment to `ARCHIVE_PENDING`; the second is rejected by the
guard at `archive.service.ts:71-72`, which admits only `CLOSED`.

So `archiveSegment` is **not idempotent under retry**, while the test asserts that it is.
One of the two is wrong, and deciding which is a statement about what B8 is supposed to
guarantee:

- If archiving must be safe to retry — the natural reading, since a partially completed
  archive would otherwise strand a segment in `ARCHIVE_PENDING` — the **implementation** is
  incomplete and should return the existing manifest for a segment already archived or
  mid-archive.
- If archiving is intended to be strictly single-shot, the **test** is asserting a guarantee
  the design never made.

**This is the only failure that requires a design decision rather than a repair.** It is
recorded, not resolved.

---

## (5) Smallest separately reviewable remediation commits

Six, ordered so each is independently reviewable and independently revertable. None depends on
a later one.

| #   | Commit                                                | Scope                                                                                                                                                                        | Risk                                                                        |
| --- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | Declare the two existing indexes in `schema.prisma`   | Group B — adds `@@index` for `audit_logs(segment_id)` and `segment_archived_events(segment_id, sequence)`; **no migration**                                                  | None — removes drift by matching what the database already has              |
| 2   | Add the two missing uniqueness constraints            | Group F — one migration creating `UNIQUE segment_legal_holds(segment_id, hold_id)` and `UNIQUE audit_stream_state(active_segment_id)`                                        | Low — tightening, but these tables hold no data anywhere                    |
| 3   | Align column types and defaults                       | Groups C, D, E — one migration: `JSON`→`JSONB` on two columns, drop four `updated_at` defaults, add `audit_stream_state.id DEFAULT 'main'`                                   | Low — evidenced above as behaviour-neutral today                            |
| 4   | Normalise foreign-key `ON UPDATE` and the index names | Groups A and G — one migration; `ON DELETE RESTRICT` is untouched throughout                                                                                                 | Low — cosmetic in practice                                                  |
| 5   | Repair the three test defects                         | `prisma-audit-log.repository.spec.ts` constructor, `audit-chain.service.spec.ts` sequence expectation, archive post-purge digest fixture. **Tests only — no `src/` changes** | None — makes 17 of the 18 failures pass without touching the implementation |
| 6   | Add `supertest` as a dev dependency                   | `package.json` + lockfile only                                                                                                                                               | None                                                                        |

Commits 1–4 together bring `migrate diff` to empty. Commits 5–6 bring the suite to green
**except** the idempotency test.

**Not in the list, deliberately:** the `archiveSegment` idempotency question. It needs a ruling
on intended behaviour first; only then does it become a commit, and it would be an
implementation change rather than a reconciliation.

---

## What this does not establish

- The drift analysis reasons about behaviour from the code and the database. It is not a
  substitute for **CI reproducing the fresh migration and the B8 verification on a clean
  PostgreSQL service** — the local Postgres in this session stopped twice and was rebuilt each
  time, so local success is supporting evidence, not the gate.
- The `archiveSegment` idempotency question is recorded, not answered.
- Nothing here was applied. `b8-sync` @ `95d5151` is unchanged and unpushed; remote B8 is
  still `a152a25`; PR #351 is untouched.
