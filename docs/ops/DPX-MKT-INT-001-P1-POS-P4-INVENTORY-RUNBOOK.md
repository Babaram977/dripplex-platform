# DPX-MKT-INT-001-P1 · P4 production inventory runbook

**Status:** ready to run · **not yet run**
**Blocks:** P4, and criterion 4 of the 8H POS launch gate
**Audience:** an authorized DrippleX operator with production database access

---

## 1 · Why this document exists

P4 is a decision _to look before deciding_: inventory the existing POS credentials and
webhook URLs first, then choose how to migrate or expire them, without automatically
invalidating credentials that currently work.

The ruling record (`docs/DPX-MKT-INT-001-P1-POS-RULINGS-001.md` §4) fixes the mechanism:

> an authorized operator runs the four statements and returns only the four integers — no new
> production code, no new privileged endpoint, no exposed database credentials, no Operations
> Console change, no deployment and no migration.

**A wording note, because it is the easiest thing to get wrong.** The ruling says "four
integers". There are now **five inventory questions and six output values**. Two separate reasons:

- Question 2 is stated as a comparison (`INCOMING_API_KEY` _vs_ `OUTGOING_API_KEY`) and so has
  **two** answers, not one. Collapsing it to one destroys the only question P4 asks that is a
  comparison.
- Question 5 (`c5`) was **added on 2026-09-14** after the 99-year credential ruling, to size the
  legacy population before deciding how to treat it.

**Report all six.** The original five are unchanged in meaning and name.

This runbook exists so that the operator's step is a copy-paste rather than a drafting
exercise, and so the statement has been proven correct against the real schema _before_ it is
pointed at production.

**Nothing in this repository can run it.** No tooling available to the engineering session
can execute SQL against the production database, and the routes that would create such access
— rendering `DATABASE_URL`, or opening a TCP proxy onto the database service — are exactly
what the mechanism above rules out. That is a deliberate constraint, not a missing capability
to be worked around.

---

## 2 · Safety properties

- **Read-only.** One `SELECT`. No `INSERT`, `UPDATE`, `DELETE` or DDL.
- **Aggregates only.** Every selected value is a `count(*)`. No credential hash, no plaintext
  secret, no webhook URL, no merchant-identifying value is returned by any part of it.
- **No locks, no writes, no deployment.** Safe to run against production during traffic.

---

## 3 · The statement

Run against the production database. It returns **a single row of six output values** — five
inventory questions, six answers. Report every one.

`c5` was added on 2026-09-14, after the 99-year ruling, for a decision the original four could not
inform. It is an **additional** value: the original five are unchanged in both meaning and name.

```sql
SELECT
  (SELECT count(*) FROM merchant_integrations
     WHERE webhook_url LIKE 'http://%')                        AS c1_http_webhooks,
  (SELECT count(*) FROM integration_credentials
     WHERE archived_at IS NULL
       AND credential_type = 'INCOMING_API_KEY')               AS c2a_active_incoming_api_key,
  (SELECT count(*) FROM integration_credentials
     WHERE archived_at IS NULL
       AND credential_type = 'OUTGOING_API_KEY')               AS c2b_active_outgoing_api_key,
  (SELECT count(*) FROM integration_credentials
     WHERE archived_at IS NULL
       AND EXISTS (
         SELECT 1 FROM unnest(scopes) AS s
         WHERE s <> ALL (ARRAY[
           'catalog:read','catalog:write',
           'inventory:read','inventory:write',
           'orders:read','orders:write'
         ])
       ))                                                      AS c3_out_of_vocabulary_scopes,
  (SELECT count(*) FROM integration_credentials
     WHERE archived_at IS NULL
       AND expires_at IS NULL)                                 AS c4_no_expiry,
  (SELECT count(*) FROM integration_credentials
     WHERE archived_at IS NULL
       AND expires_at IS NOT NULL
       AND expires_at
           < COALESCE(rotated_at, created_at) + interval '1 year')
                                                               AS c5_legacy_short_lifetime;
```

### Five output values from four inventory questions

Count 2 is stated in the ruling as a comparison — _"active `INCOMING_API_KEY` vs
`OUTGOING_API_KEY`"_ — so it necessarily yields **two** numbers. The other three are answered
one-for-one.

| Inventory question                                      | Output value(s)                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------- |
| 1 · existing `http://` webhook URLs                     | `c1_http_webhooks`                                                  |
| 2 · active `INCOMING_API_KEY` **vs** `OUTGOING_API_KEY` | `c2a_active_incoming_api_key` **and** `c2b_active_outgoing_api_key` |
| 3 · credentials carrying scopes outside R4's six        | `c3_out_of_vocabulary_scopes`                                       |
| 4 · credentials with no `expiresAt`                     | `c4_no_expiry`                                                      |
| 5 · credentials stamped with a **pre-99-year** lifetime | `c5_legacy_short_lifetime`                                          |

Five questions · **six values**. If the returned row has fewer than six numbers in it, one has
been dropped.

### Interpretations made explicit

These are judgement calls the statement encodes. They are written down so that a reader can
disagree with them rather than have to reverse-engineer them:

| Term                                        | Encoded as                                                                              | Why                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **"active" credential**                     | `archived_at IS NULL`                                                                   | Archived rows are soft-deleted and cannot authenticate. Counting them would overstate the live surface.                                                                                                                                                                                                                                    |
| **"existing `http://` webhook"**            | `webhook_url LIKE 'http://%'`                                                           | Matches the scheme prefix only. `https://` is excluded by the `://` in the pattern; a NULL webhook is excluded by `LIKE`.                                                                                                                                                                                                                  |
| **"scopes outside the six approved by R4"** | anything not in `catalog:{read,write}`, `inventory:{read,write}`, `orders:{read,write}` | R4 fixes the vocabulary at exactly six and explicitly excludes `integrations:*`.                                                                                                                                                                                                                                                           |
| **`c5` "stamped lifetime"**                 | `expires_at - COALESCE(rotated_at, created_at)`                                         | **Not `created_at` alone.** Rotation does not create a new row — the `@@unique([integrationId, credentialType])` constraint means `createCredential` **reuses** the archived row via `update`, setting `rotated_at` and leaving `created_at` at the _original_ creation. Anchoring on `created_at` would misread every rotated credential. |
| **`c5` boundary — 1 year**                  | `< COALESCE(rotated_at, created_at) + interval '1 year'`                                | A **separator, not a threshold.** The two policies are 90 days and 99 years — three orders of magnitude apart — so any cut between them gives the same answer. It encodes no business judgement, unlike 8D-C's stranding threshold, which is why it is safe to put in SQL.                                                                 |
| **expiry**                                  | `expires_at IS NULL`                                                                    | Per the schema: _"Null = doesn't expire."_                                                                                                                                                                                                                                                                                                 |

`c1` deliberately does **not** filter `archived_at`, because `merchant_integrations.archived_at`
marks a retired integration rather than a retired URL, and PR #398's grandfathering question is
about every `http://` row still present. If the intent is instead "rows webhook delivery could
actually use", add `AND archived_at IS NULL` — but that is a different question and should be
recorded as such.

---

## 4 · Verification already performed

The statement was executed against a **local** database migrated to the same schema (all 147
migrations applied), first empty and then seeded with rows designed to make each predicate
prove itself:

| Fixture                                                                        | Intended to be         |
| ------------------------------------------------------------------------------ | ---------------------- |
| integration with `http://` webhook                                             | **counted** by c1      |
| integration with `https://` webhook                                            | excluded from c1       |
| integration with `NULL` webhook                                                | excluded from c1       |
| credential A — active `INCOMING_API_KEY`, approved scopes, has expiry          | counted by c2a only    |
| credential B — active `OUTGOING_API_KEY`, scope `integrations:read`, no expiry | counted by c2b, c3, c4 |
| credential C — **archived**, scope `integrations:write`, no expiry             | **excluded from all**  |

`c5` was verified separately, against fixtures built to break it:

| Fixture                                                           | Stamped | Rotated? | Intended                                                   |
| ----------------------------------------------------------------- | ------- | -------- | ---------------------------------------------------------- |
| A — issued under P3, never rotated                                | 90 d    | no       | **counted** by c5                                          |
| B — created 200 d ago, **rotated today** under the 99-year policy | 99 y    | **yes**  | **excluded** — the case `created_at` alone would get wrong |
| C — created 200 d ago, **rotated** under P3                       | 90 d    | **yes**  | **counted**                                                |
| D — fresh 99-year, never rotated                                  | 99 y    | no       | excluded                                                   |
| E — `expires_at IS NULL`                                          | —       | no       | excluded from c5; counted by **c4**                        |
| F — archived legacy                                               | 90 d    | no       | excluded                                                   |

Result: **`c5 = 2` (A and C), `c4 = 1` (E)** — exactly as predicted, and **disjoint**.

**B is the load-bearing fixture.** Its current expiry complies with the new policy, but its
`created_at` long predates it. Anchoring on `created_at` would have counted it as legacy;
anchoring on `COALESCE(rotated_at, created_at)` correctly excludes it. Its counterpart C proves
the same anchor still catches a rotation performed _under the old policy_.

Result: `c1=1, c2a=1, c2b=1, c3=1, c4=1` — every count exactly as predicted.

Credential C is the load-bearing fixture: it would have matched both c3 and c4 had the
`archived_at IS NULL` filter been wrong or missing, so its exclusion is what demonstrates the
filter works rather than merely being present.

This proves the statement is syntactically valid and schema-correct, and that its predicates
discriminate. **It says nothing about production's contents,** which are unknown until it runs.

---

## 5 · Recording the result

Return only the integers — **all six of them**, labelled with the column names the statement
assigns, so a missing value is visible rather than ambiguous:

```
c1_http_webhooks            = ____
c2a_active_incoming_api_key = ____
c2b_active_outgoing_api_key = ____
c3_out_of_vocabulary_scopes = ____
c4_no_expiry                = ____
c5_legacy_short_lifetime    = ____
```

### c5 is an as-of value, unlike the other five

**`c5` is the only one of the six that moves on its own.** Legacy credentials keep lapsing on
their original 90-day schedule, so the population shrinks between the moment it is measured and
any decision taken on it. The other five describe structural facts that change only when someone
changes them.

So `c5` must be written down as

```
c5_legacy_short_lifetime = N   as of <UTC timestamp of the run>
```

and read that way afterwards. **`c5 = N` is not a standing description of production**, and a
later decision should treat the execution timestamp as the provenance boundary rather than
assuming the number is still current.

A stale `c5` errs in the safe direction — it **overstates** the population, because the only
movement is downward — but "directionally conservative" is not the same as "current", and it
should not be presented as current production state.

Record alongside them:

- the exact timestamp (UTC) and the environment the statement ran against;
- the statement as actually executed, if it was modified in any way;
- who ran it.

Then update `docs/DPX-MKT-INT-001-P1-POS-RULINGS-001.md` §4 and the P4 row in §5, and
re-assess criterion 4 of `docs/DPX-MKT-INT-001-P1-POS-LAUNCH-GATE-8H.md`.

**Do not infer the counts, estimate them, or carry them forward from any other environment.**
An inventory whose numbers were guessed is worse than no inventory, because P4's whole purpose
is to avoid deciding the migration and expiry treatment of live credentials on an assumption.

---

## 6 · What the numbers will decide

| Count                                | If it is zero                                                                               | If it is non-zero                                                                                                                                                                                                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **c1** `http://` webhooks            | PR #398's grandfathering clause is inert; HTTPS-only is already total.                      | Those rows must be migrated or explicitly handled _before_ webhook delivery is built.                                                                                                                                                                                                                |
| **c2a / c2b**                        | —                                                                                           | Per R5, `OUTGOING_API_KEY` rows are stored AES-GCM and cannot authenticate against the incoming bcrypt path. A non-zero c2b is a population of credentials that _never could have worked_, and its size determines whether recovery-and-rehash is worth attempting at all.                           |
| **c3** out-of-vocabulary scopes      | R4's vocabulary is already clean.                                                           | Each such credential needs a decision: narrow it, or accept it as grandfathered.                                                                                                                                                                                                                     |
| **c4** no expiry                     | Every credential is bounded.                                                                | Under the 99-year ruling a `NULL` expiry is **non-compliant with issuance policy** — it came through the legacy `createCredential` path, which defaults the field to `null`. So this counts **policy bypass**, not "credentials that predate a policy".                                              |
| **c5** legacy short lifetime (as-of) | No credential is still on the pre-99-year policy; the existing-credential decision is moot. | This is the population the **existing-credential decision** acts on: leave them to lapse, extend, or handle conditionally. Extending them would be a **production write against live credentials** and needs its own authorization. The count exists so that decision is not made blind to its size. |
