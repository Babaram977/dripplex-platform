# DPX-CREDENTIAL-LEGACY-EXTENSION-001 · the legacy 90-day credential population

**Ruled 2026-09-15.** Mechanism implemented and verified. **Not executed in production.**

---

## 1 · The ruling

| Case                                        | Treatment                                          |
| ------------------------------------------- | -------------------------------------------------- |
| Live legacy credential, **not yet expired** | **Extend to the 99-year lifetime.**                |
| Legacy credential **already expired**       | **Stays expired.** Never silently reactivated.     |
| New credential                              | 99-year expiry at issuance (PR #406).              |
| Merchant contract cancelled                 | Revoked/disabled regardless of remaining lifetime. |

The expired/non-expired split is the load-bearing distinction. Extending a live credential is a
**lifetime adjustment**; extending an expired one is **restoring access that has already died**.
Those are different security acts, and the second is deliberately out of scope here.

---

## 2 · Why "leave them to lapse" was rejected

It is not a neutral do-nothing option. Two facts, both verified in the code rather than assumed:

- **There is no expiry warning anywhere in the backend.** No notification, reminder or
  "expiring soon" signal exists. A merchant gets no advance notice.
- **An expired credential is indistinguishable from a wrong key.** The POS authentication lookup
  filters `OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]`, so an expired credential simply
  fails to match and returns `unauthenticated` — **401, with a body identical to a bad key**.

R6 gave integrators the ability to tell _"your key is wrong"_ from _"your key may not do this"_.
**"Your key has expired" is still collapsed into "your key is wrong."**

So leaving the population alone means: over the following ≤90 days each legacy credential lapses,
and each lapse stops a till **mid-shift, with no warning, behind an error that misdirects whoever
investigates**. That is precisely the failure the 99-year ruling was made to end — "leave" would
have preserved it for one last cycle.

---

## 3 · The mechanism

`apps/backend/prisma/extend-legacy-credential-expiry.cjs` — an **operator-run** script, following
the convention of `settle-unpaid-deliveries.cjs` and `retire-test-merchants.cjs`.

**It is deliberately NOT a Prisma migration.** A data migration in `prisma/migrations/` would be
executed automatically by `prisma migrate deploy` on the next deploy — that is, it would perform a
production credential write with no operator present and no explicit authorization. The ruling
requires the opposite.

It is also **not** in Railway's `preDeployCommand`, which runs only `prisma/seed-rbac.cjs`.

### Selection

```
archivedAt IS NULL           live credentials only
expiresAt IS NOT NULL        a NULL expiry is the separate c4 population — not legacy
expiresAt > now()            not already expired
expiresAt < issued + 1 year  stamped under the old policy
```

### The new date: `issued + 99 years`, not `now() + 99 years`

`issued` is `COALESCE(rotatedAt, createdAt)` — the moment the current expiry was actually stamped.

**Rotation does not create a new row.** The `@@unique([integrationId, credentialType])` constraint
means `createCredential` **reuses** the archived row via `update`, setting `rotatedAt` and leaving
`createdAt` at the original creation. Anchoring on `createdAt` alone would misread every rotated
credential.

Anchoring on issuance rather than on `now` buys two properties:

- a migrated credential ends up with **exactly the date it would have been given** had it been
  issued under the new policy, so it is indistinguishable from a native one;
- the script is **idempotent** — re-running recomputes the same date rather than pushing the
  expiry further out each time.

### Safety

- **Dry run by default**; `--apply` required to write.
- Each write is a `updateMany` **guarded on the expiry that was read**, so a credential rotated or
  revoked between the scan and the write is **skipped**, not overwritten.
- Reports skips explicitly rather than silently.

---

## 4 · Verified against fixtures

| Fixture                                             | State    | Intended                         | Result          |
| --------------------------------------------------- | -------- | -------------------------------- | --------------- |
| 1 — legacy 90 d, valid, never rotated               | valid    | **extend**                       | → 2125-08-16 ✅ |
| 2 — created 200 d ago, **rotated** 5 d ago under P3 | valid    | **extend, anchored on rotation** | → 2125-09-10 ✅ |
| 3 — legacy, **already expired**                     | expired  | **leave**                        | unchanged ✅    |
| 4 — already 99-year                                 | valid    | leave                            | unchanged ✅    |
| 5 — `expiresAt` NULL (c4 population)                | —        | leave                            | unchanged ✅    |
| 6 — archived legacy                                 | archived | leave                            | unchanged ✅    |

- Dry run changed **nothing**.
- Apply extended **2 of 2**; rows 3–6 untouched.
- Re-run: `WILL EXTEND = 0`. Re-apply: `Nothing to extend` — **idempotent**.

Fixture 2 is load-bearing: it is the case `createdAt` alone gets wrong, and it anchored correctly
on its rotation date.

---

## 5 · c5 is NOT the blast radius

The P4 inventory's `c5_legacy_short_lifetime` counts **every** live legacy credential — expired or
not. This script only extends the **non-expired** subset. Using `c5` as the blast-radius figure
would therefore **overstate** it.

The script's own dry run prints both numbers, so they reconcile rather than being guessed at:

```
legacy lifetime (this is what P4 c5 counts): N
  of which still valid     -> WILL EXTEND:   X
  of which already expired -> LEFT ALONE:    Y        (N = X + Y)
```

**After the migration, `c5` should equal Y** — the expired population. That is the post-migration
check, and it was confirmed against the runbook's independently-written SQL: the script predicted
`c5 = 1` and the runbook statement returned `1`.

The blast radius is therefore **X, measured in the same session as the write**, not a count taken
in advance.

---

## 6 · Execution sequence — NOT yet performed

1. Run the P4 six-value inventory (`DPX-MKT-INT-001-P1-POS-P4-INVENTORY-RUNBOOK.md` §3).
2. Run this script **without `--apply`** — its `WILL EXTEND` figure is the exact blast radius.
3. **Obtain explicit authorization for the production write**, against that figure.
4. Run with `--apply`.
5. Re-run without `--apply`: `WILL EXTEND` must be `0`.
6. Re-run the P4 statement: `c5` must equal the `LEFT ALONE` figure.

Steps 3–6 are a **production credential write**. Nothing in this document or the accompanying PR
performs one, and no authorization for it is implied by either.

---

## 7 · Still open

- **CRIT-005 restatement** — the risk register still says "API keys must rotate every 90 days",
  which now contradicts the shipped policy.
- **Expiry warning** — no mechanism exists. Worth having regardless of this migration, but it is a
  separate reliability/product improvement and does not solve the legacy population.
- **Already-expired credentials** — left expired. Whether any should be restored is a distinct
  security decision that has not been taken.
