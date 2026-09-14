# DPX-P1-B-SERIES — status of record

**Documentation only.** No production code changed. No migration, no schema, no
service, no infrastructure. `#387` is not altered or rolled back.

**Date:** 2026-09-14 · **Repository state:** `main` @ `c2affb7c`

---

## Why this document exists

Asked to identify the formally specified next increment of the P1 audit
programme, the answer turned out to be that **no formal specification of it
exists in this repository.** This file records what is actually here, so that
the next engineer does not have to repeat the search — and does not mistake
reconstruction for specification, which is the failure this file exists to
prevent.

Three things are kept strictly apart below, because conflating them is how a
comment on a deleted branch becomes a requirement:

1. **Formal specification** — authoritative text committed to `main`.
2. **Historical archaeology** — statements found on branches and in code
   comments. Evidence of intent. **Not specification.**
3. **Implementation reality** — what the code on `main` does today.

---

## 1. Formal specification on `main`

**There is none.**

| Artifact                                                       | Present on `main`? |
| -------------------------------------------------------------- | ------------------ |
| Contract 14 text                                               | **No**             |
| Definition of P1-B1 … P1-B8                                    | **No**             |
| `p1-b4-evidence-gate.yml` (last place the vocabulary appeared) | **No — removed**   |
| `p1-b2-postgres-verification.yml`                              | **No**             |

This was already recorded. `docs/DPX-AUDIT-001-PLATFORM-REALITY-2026-09-07.md`
§H.3, written 2026-09-07:

> Across **every branch** in this repository, the string "Contract 14" appears
> exactly once: a code comment in
> `apps/backend/src/audit/archive/six-part-verifier.ts` on the unmerged B8
> branch … There is **no Contract 14 document**.
>
> The same holds for the programme vocabulary: **P1-B2, B4, B5, B6, B8 exist
> only in the `p1-b4-evidence-gate.yml` workflow and in documents on unmerged
> branches.** Nothing on `main` defines them.

That audit's single remaining anchor has since gone: `p1-b4-evidence-gate.yml`
is no longer on `main`. The workflows there today are `attach-cf-domains`, `ci`,
`deploy-backend-api`, `deploy-cloudflare-workers`, `deploy-production`,
`deploy-staging`, `golive-preflight`, `mobile-build`,
`mobile-store-readiness`, `publish-images`, `release-tag`. None mentions the
B-series.

The only files on `main` containing the string `P1-B` are the September audit,
the B2 evidence report, and the B2 implementation itself. **None of them defines
the programme.** They use its vocabulary.

### What this blocks

The September audit's recommendation stands, unactioned:

> commit the Contract 14 text and the P1 B-series definitions to `docs/` on
> `main`. Until then, treat every transaction boundary, sequence authority,
> lifecycle authority, cryptographic, recovery-fencing, archive-proof,
> purge-authority and control-stream change in the audit subsystem as requiring
> explicit authorization.

**The authoritative Contract 14 text is absent from this repository and must be
supplied before compliance-critical implementation proceeds.** It cannot be
reconstructed from code comments without inventing it, and an invented contract
is worse than an absent one: it looks authoritative and binds no one.

---

## 2. Historical archaeology — NOT specification

Everything in this section comes from **PR #351** (`claude/p1-b8-archive-purge-6o3vb8`),
closed on 2026-09-14 as superseded, and from code comments on that branch. It is
recorded as evidence of intent and **must not be treated as a requirement**.

| Increment       | What the artifacts say                                                                             | Source                                                |
| --------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **B1**          | The `append()` interface boundary; "hash must be deterministic based on P1-B1 event boundary only" | `audit.service.ts`, `audit-chain.service.ts` comments |
| **B2**          | Segments, segment authority, global sequence                                                       | `docs/DPX-P1-B2-VERIFICATION.md`                      |
| **B3**          | Never named. "Blocked per CTO guidance"                                                            | B2 verification doc                                   |
| **B4**          | "(Segment Closure): Implement transition `ACTIVE → CLOSED` logic and enforcement"                  | B2 verification doc                                   |
| **B5**          | "(Archive Authority): Implement `CLOSED → ARCHIVE_PENDING → ARCHIVED_VERIFIED` transitions"        | B2 verification doc                                   |
| **B6**          | "Failure Recovery Subsystem" — owns delivery guarantees                                            | `audit.service.ts` comment                            |
| **B7**          | "During P1-B7, wallet mutations will migrate to `append(tx, event)`"                               | `audit.service.ts` comment                            |
| **B8.2 / B8.3** | Archive models; archive engine and immutable archived events                                       | #351 title and code                                   |

The September audit additionally records **B2, B4 CLOSED and B5
SATISFIED / ZERO-DELTA** as of 2026-09-07 — statuses that referred to work on
that branch, none of which was on `main` then, and only B2 is on `main` now.

### The dependency picture these artifacts suggest

```
B1 (append boundary)  →  B7 (migrate existing writers)  →  B8.2  →  B8.3
```

with **B2 landed**, and the B4 / B5 / B6 relationships requiring formal
confirmation. Stated as what the artifacts suggest. **This is not an approved
roadmap and must not be cited as one.**

Two consequences follow from the artifacts alone and are worth stating plainly,
because both were previously misunderstood — including by the author of this
document:

- `append()` is **B1**, not an unnamed gap between B2 and B8. B1 is described as
  already-established interface; **no `append()` exists on `main`.**
- The migration of existing audit writers is **B7**, a named increment — not an
  implementation detail of B8.

---

## 3. Implementation reality on `main` today

| Component                                                        | On `main`?                                                                          |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `audit_segments`, `audit_stream_state`, lifecycle enum           | **Yes** — migration `20260914090000`                                                |
| Four nullable authoritative columns on `audit_logs`              | **Yes**, plus the atomicity CHECK and the global partial unique index on `sequence` |
| `SegmentAuthorityService` — sequence allocation, segment closure | **Yes**                                                                             |
| `PrismaAuditSegmentRepository` — closure and successor creation  | **Yes**                                                                             |
| `append()` / authoritative write path                            | **No**                                                                              |
| Hash-chain service                                               | **No**                                                                              |
| Authoritative-write boundary trigger                             | **No** — excluded deliberately; see below                                           |
| Archive models, archive engine, six-part verifier, purge         | **No**                                                                              |
| Audit controller                                                 | **No**                                                                              |

**Nothing writes to the new tables.** All **404** call sites that record audit
rows still use `AuditService.record()`, which produces the legacy shape. The
foundation is correct, verified and unused — by design, not by omission.

The authoritative-write boundary trigger from #351 was excluded because it
rejects exactly the row `record()` produces; installing it before those callers
move would make every audited write throw on a platform taking live money.

---

## 4. Correction to the record: what #387 actually contains

`#387` is titled and described as the **B2 foundation**. It also implements
**segment closure**, which the historical decomposition assigned to **B4**.

`docs/DPX-P1-B2-VERIFICATION.md` on the #351 branch states under
_What P1-B2 Does NOT Implement_:

> ❌ **Lifecycle state machine** (deferred to P1-B4)
> ❌ **Segment closure logic** (deferred to P1-B4)

`#387` ships `SegmentAuthorityService.closeSegment` and
`PrismaAuditSegmentRepository.closeSegment` — closure, successor creation, the
stream-state move, idempotency, and refusal to close an empty segment. Five of
its sixteen tests cover closure.

**The discrepancy is recorded, not undone.** The code is tested, mutation-checked
and deployed; reverting a sound, live migration to make PR history tidy would
trade real risk for cosmetics. What matters is that a future engineer does not
open B4 expecting to find closure unimplemented.

**Corrected status:**

|                                          |                                                                                                                                                                                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original decomposition                   | B2 = segments + authority + global sequence · B4 = segment closure                                                                                                                                                               |
| Actual `#387`                            | B2 foundation **and** segment-closure implementation                                                                                                                                                                             |
| Still missing from B4's historical scope | The **lifecycle state machine** — transitions beyond `ACTIVE → CLOSED`, i.e. everything touching `ARCHIVE_PENDING`, `ARCHIVED_VERIFIED`, `PURGE_AUTHORIZED`, `PURGED`. The enum values exist; no code moves a segment into them. |

How it happened: the increment was scoped from the instruction "audit segments,
segment authority, global sequence", and closure is what the segment authority
service does. The boundary was not checked against the historical decomposition
until after the merge.

---

## 5. What is required before more B-series implementation

1. **The authoritative Contract 14 text**, supplied by whoever holds it, and
   committed to `docs/` on `main`. It is not in this repository.
2. **The B-series definitions**, likewise committed — B1, B3, B4, B5, B6, B7 and
   B8 scoped by their owner, not reconstructed here.
3. **Formal confirmation** of the B4 / B5 / B6 relationships and of the
   dependency order in §2.

Until then the chain has a missing first link:

```
Contract → documented increment → implementation → evidence → authorization → merge → production
```

Everything from _implementation_ rightward has been working well on this
programme. _Contract_ and _documented increment_ are absent for the audit
subsystem, and no amount of verification downstream compensates for that.

## 6. Explicitly not done here

- No Contract 14 invented, paraphrased or reconstructed.
- **No placeholder specifications** written for B1, B3, B4, B5, B6, B7 or B8.
  §2 is a record of found statements, not a definition of scope.
- No `append()`, no hash-chain service, no migration of the 404 audit writers,
  no authoritative-write trigger, no archive functionality.
- No production code, schema, migration or infrastructure change.
- `#387` untouched. `#386` (persona domains) untouched.
