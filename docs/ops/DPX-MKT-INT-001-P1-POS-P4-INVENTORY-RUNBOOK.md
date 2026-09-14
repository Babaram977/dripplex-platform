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

Run against the production database. It returns a single row of five integers.

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
       AND expires_at IS NULL)                                 AS c4_no_expiry;
```

### Why five integers for four questions

Count 2 is stated in the ruling as a comparison — _"active `INCOMING_API_KEY` vs
`OUTGOING_API_KEY`"_ — so it necessarily yields two numbers. The four questions are otherwise
answered one-for-one.

### Interpretations made explicit

These are judgement calls the statement encodes. They are written down so that a reader can
disagree with them rather than have to reverse-engineer them:

| Term                                        | Encoded as                                                                              | Why                                                                                                                       |
| ------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **"active" credential**                     | `archived_at IS NULL`                                                                   | Archived rows are soft-deleted and cannot authenticate. Counting them would overstate the live surface.                   |
| **"existing `http://` webhook"**            | `webhook_url LIKE 'http://%'`                                                           | Matches the scheme prefix only. `https://` is excluded by the `://` in the pattern; a NULL webhook is excluded by `LIKE`. |
| **"scopes outside the six approved by R4"** | anything not in `catalog:{read,write}`, `inventory:{read,write}`, `orders:{read,write}` | R4 fixes the vocabulary at exactly six and explicitly excludes `integrations:*`.                                          |
| **expiry**                                  | `expires_at IS NULL`                                                                    | Per the schema: _"Null = doesn't expire."_                                                                                |

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

Result: `c1=1, c2a=1, c2b=1, c3=1, c4=1` — every count exactly as predicted.

Credential C is the load-bearing fixture: it would have matched both c3 and c4 had the
`archived_at IS NULL` filter been wrong or missing, so its exclusion is what demonstrates the
filter works rather than merely being present.

This proves the statement is syntactically valid and schema-correct, and that its predicates
discriminate. **It says nothing about production's contents,** which are unknown until it runs.

---

## 5 · Recording the result

Return only the integers. Record alongside them:

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

| Count                           | If it is zero                                                          | If it is non-zero                                                                                                                                                                                                                                                          |
| ------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **c1** `http://` webhooks       | PR #398's grandfathering clause is inert; HTTPS-only is already total. | Those rows must be migrated or explicitly handled _before_ webhook delivery is built.                                                                                                                                                                                      |
| **c2a / c2b**                   | —                                                                      | Per R5, `OUTGOING_API_KEY` rows are stored AES-GCM and cannot authenticate against the incoming bcrypt path. A non-zero c2b is a population of credentials that _never could have worked_, and its size determines whether recovery-and-rehash is worth attempting at all. |
| **c3** out-of-vocabulary scopes | R4's vocabulary is already clean.                                      | Each such credential needs a decision: narrow it, or accept it as grandfathered.                                                                                                                                                                                           |
| **c4** no expiry                | Every credential is bounded.                                           | Determines whether an expiry policy can be applied prospectively or needs a backfill.                                                                                                                                                                                      |
