# DPX-PRODUCTION-READ-SESSION-001 · the three production reads, in one operator session

**Status:** ready to run · **not yet run**
**Scope:** an operator convenience that sequences three _separate_ reads. It does not merge them.
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

### Sharing a session is not sharing a gate

This document is an **operator convenience** — one sitting, one set of timestamps. It does not
merge these three into a single piece of work, and nothing here should be read as widening P4:

|                           |                                                                                                                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P4 is A, and only A.**  | P4 is the credential/integration **inventory** gate. Its outputs are the six values in step A — no more, no fewer. It is what criterion 4 of the 8H launch gate is re-assessed against.   |
| **B is not a P4 output.** | It shares the session because it must reconcile with `c5`. It informs the **existing-credential decision**, which is downstream of P4, not part of it.                                    |
| **C is not a P4 output.** | 8D-C is valuable launch evidence about order fulfilment. It is a **separate measurement with its own ruling**, and it rides along only for timestamp consistency and operator efficiency. |

So: a completed 8D-C count does **not** advance P4, and an incomplete one does **not** hold it
back. If only A is run, P4 is answered. If C is run and A is not, P4 is untouched.

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

Report every figure with its UTC timestamp. Then act on each read **in its own track** — they
were measured together, but they land in different places:

**A → the P4 gate.**

1. Update `DPX-MKT-INT-001-P1-POS-RULINGS-001.md` §4 and the P4 row in §5.
2. Re-assess criterion 4 of `DPX-MKT-INT-001-P1-POS-LAUNCH-GATE-8H.md`.

**B → the existing-credential decision, which is downstream of P4 and still a separate write.**

3. Record the three figures against `DPX-CREDENTIAL-LEGACY-EXTENSION-001.md` §6.
4. Knowing `WILL EXTEND` **does not authorize `--apply`.** The count exists so the decision is
   not taken blind to its size; the decision itself is still to be taken, explicitly, against
   that number. A dry run that produced a comfortable figure is not an approval.

**C → 8D-C's own record. It does not touch the P4 gate.**

5. Record `s1` and its threshold against `DPX-ORDER-8D-C-STRANDED-MEASUREMENT.md` §6.
6. Remediation remains undecided. The number describes a population; it does not authorize
   doing anything to it.

**Do not infer, estimate, or carry any of these counts forward from another environment.**
Each of these numbers exists so a decision is not taken blind to its size; a guessed one defeats
the entire purpose of taking it.
