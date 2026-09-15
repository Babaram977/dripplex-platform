# DPX-PRODUCTION-READ-SESSION-001 · the three production reads, in one operator session

**Status:** ready to run · **not yet run**
**Audience:** an authorized DrippleX operator with production database access
**Nothing in this document writes anything.** Every step is a `SELECT` or a dry run.

---

## 1 · Why these three ride together

Three separate pieces of work each need a number from production. They are collected here
because two of them are **as-of** values that move on their own, so numbers taken in different
sessions cannot be reconciled with each other afterwards:

| Read                              | Document                                         | Kind                        |
| --------------------------------- | ------------------------------------------------ | --------------------------- |
| **A** · P4 six-value inventory    | `DPX-MKT-INT-001-P1-POS-P4-INVENTORY-RUNBOOK.md` | five structural, `c5` as-of |
| **B** · legacy-credential dry run | `DPX-CREDENTIAL-LEGACY-EXTENSION-001.md`         | as-of, and the blast radius |
| **C** · 8D-C stranded orders      | `DPX-ORDER-8D-C-STRANDED-MEASUREMENT.md`         | as-of, moves both ways      |

**B must be measured in the same session as A**, because B's `WILL EXTEND` figure and A's `c5`
reconcile against each other (`c5 = WILL EXTEND + LEFT ALONE`). Taken hours apart they will not
agree, and the disagreement would look like a defect rather than elapsed time.

---

## 2 · Why the engineering session cannot run these

Re-verified **2026-09-15** against the actual tooling, not carried forward as a claim:

| Mechanism attempted                                | Result                                                                                                                                                                |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Railway MCP agent (`railway-agent`)                | **No SQL execution capability.** No `executeSQL`/`runQuery` tool; file tools read but do not execute; DB credentials are deliberately not exposed to the agent layer. |
| `list-variables`                                   | Would render `DATABASE_URL` in plaintext. **Excluded** — exposing it is forbidden.                                                                                    |
| `create-tcp-proxy`                                 | Would expose Postgres publicly. **Excluded** — a public database proxy is forbidden.                                                                                  |
| Deploy a temporary function reading `DATABASE_URL` | **Excluded by the P4 ruling itself:** "no new production code, no new privileged endpoint, no exposed database credentials … no deployment and no migration."         |

This is a **deliberate constraint, not a missing capability to be worked around.** The reads
require an authorized operator.

---

## 3 · The session, in order

Run A and B in the same sitting. C may follow immediately or later; it reconciles with nothing.

### Step 0 · record the context

```
operator   = ____
environment= production
started    = ____ (UTC)
```

### A · the P4 six-value inventory

Statement: `DPX-MKT-INT-001-P1-POS-P4-INVENTORY-RUNBOOK.md` §3 — one `SELECT`, six aggregates,
no identifying value returned.

```
c1_http_webhooks            = ____
c2a_active_incoming_api_key = ____
c2b_active_outgoing_api_key = ____
c3_out_of_vocabulary_scopes = ____
c4_no_expiry                = ____
c5_legacy_short_lifetime    = ____   as of ____ (UTC)
```

**Six values from five questions.** If fewer than six numbers come back, one has been dropped —
question 2 is a comparison and yields two.

### B · the legacy-credential dry run

From `apps/backend`, in a Railway shell on the backend service:

```
node prisma/extend-legacy-credential-expiry.cjs
```

**Without `--apply`.** The script is dry-run by default and changes nothing. Record all three
figures it prints:

```
legacy lifetime (what c5 counts) = ____
  WILL EXTEND (still valid)      = ____     <- THE BLAST RADIUS
  LEFT ALONE  (already expired)  = ____
```

> **Do not infer the blast radius from `c5`.** `c5` counts every live legacy credential, expired
> or not; the script extends only the non-expired subset. Using `c5` would **overstate** it.

**Reconciliation check:** `c5` from step A should equal `WILL EXTEND + LEFT ALONE`. If it does
not, stop and report the discrepancy rather than proceeding — the two were written independently,
so a mismatch means one of them is wrong.

### C · the 8D-C stranded-order measurement

Statement: `DPX-ORDER-8D-C-STRANDED-MEASUREMENT.md` §2 — one `SELECT`, one aggregate.

```
s1_potentially_stranded_confirmed = ____   as of ____ (UTC)
threshold in force                = 30 minutes
```

Record the threshold alongside the number, so a figure measured under one policy is never
compared against one measured under another.

---

## 4 · What must NOT happen in this session

- **No `--apply`.** Extending live credentials is a production write and needs its own explicit
  authorization **against the `WILL EXTEND` figure**, which does not exist until step B runs.
  Running the dry run does not authorize the write and does not imply approval of it.
- **No order mutation.** 8D-C is detection only: nothing cancels, declines, advances, releases
  inventory or otherwise touches an order. Remediation is an undecided separate ruling.
- **No credential values, hashes, plaintext secrets, webhook URLs or merchant-identifying
  values leave the session.** Every statement here returns aggregates only; report the integers,
  not rows.
- **No `DATABASE_URL` in chat, in a ticket, or in any document.**

---

## 5 · After the session

1. Report the six P4 values, the three dry-run figures, and the 8D-C count — each with its UTC
   timestamp.
2. Update `DPX-MKT-INT-001-P1-POS-RULINGS-001.md` §4 and the P4 row in §5.
3. Re-assess criterion 4 of `DPX-MKT-INT-001-P1-POS-LAUNCH-GATE-8H.md`.
4. The credential migration decision is taken **then**, against the real `WILL EXTEND` number —
   not before.

**Do not infer, estimate, or carry any of these counts forward from another environment.**
Each of these numbers exists so a decision is not taken blind to its size; a guessed one defeats
the entire purpose of taking it.
