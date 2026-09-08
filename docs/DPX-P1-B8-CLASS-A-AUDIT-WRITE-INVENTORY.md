# DPX-P1-B8 — Class-A Audit Write Migration Inventory

**Status: EVIDENCE ONLY. Read-only. No caller migrated, no compatibility bridge, no lint
suppression. B8 remains HOLD 🔴.**

Measured on `b8-sync` @ `002feaf`. Remote B8 is `a152a25`; PR #351 is untouched.

The objective is not 486 replacements. It is to establish what migration architecture the
platform actually requires.

---

## The headline

**Every one of the 361 production call sites writes its audit entry OUTSIDE any transaction.**
Not one is inside a `$transaction` block, and not one sits in a method that receives a
`Prisma.TransactionClient`.

`append(tx, event)` requires a transaction client. So this is not a rename with a threaded
parameter — for every caller there is **no transaction to thread**. The migration's real work
is deciding where transaction boundaries should be, and that is an architectural change to the
surrounding operations, not a mechanical substitution.

---

## Scope and composition

| | Files | Call sites |
| --- | --- | --- |
| **Production** | 77 | **361** |
| Specs | 33 | 125 |
| **Total** | 110 | **486** |

### `AuditService.record()` vs direct `PrismaAuditLogRepository.create()`

| Path | Production call sites |
| --- | --- |
| `AuditService.record()` | **361 — all of them** |
| `PrismaAuditLogRepository.create()` | **0** |

The two `create()` deprecation hits are both in `src/rides/ride-pricing.service.spec.ts`
(lines 122, 178) — a spec, not production. **No production code calls the repository
directly.** Every production write goes through `AuditService`, which is a single choke point
and the most useful fact in this inventory: one seam, not two.

### By domain

| Domain | Sites | | Domain | Sites |
| --- | --- | --- | --- | --- |
| auth | 68 | | promotions | 10 |
| drivers | 42 | | bookings | 9 |
| rides | 23 | | riders | 8 |
| orders | 19 | | wishlist | 8 |
| fleets | 15 | | cart | 7 |
| merchants | 15 | | reviews | 7 |
| wallet | 15 | | cms, fraud, loyalty, utilities | 6 each |
| notification-center | 14 | | addresses, commercial, kyc | 5 each |
| referrals | 14 | | operations | 4 |
| payments | 13 | | delivery, search | 2 each |
| products | 13 | | messaging, users | 1 each |
| integrations | 12 | | | |

30 domains. This is the whole platform, not a corner of it.

---

## The six categories

| # | Category | Production sites | Evidence |
| --- | --- | --- | --- |
| 1 | Already inside a Prisma transaction | **0** | Brace-range analysis of every `$transaction(...)` span against every call-site offset |
| 2 | Transaction available indirectly | **0** | No enclosing method signature takes `tx: Prisma.TransactionClient` |
| 3 | Multiple writes that should stay atomic — audit currently outside | **108** (19 files) | These files *do* use `$transaction`, but the audit call always falls after it closes |
| 4 | Standalone audit write, no transaction anywhere in the file | **253** (58 files) | No `$transaction` in the file at all |
| 5 | Semantics differ between `record()` and `append()` | **361 — all** | See "Signature and semantics" below |
| 6 | Cannot migrate without architectural work | **361 — all** | Follows from categories 1 and 2 being empty |

Categories 1 and 2 being **empty** is the finding. There is no population of easy callers to
migrate first.

### Worked example of category 3

`src/bookings/bookings.service.ts`: the `$transaction` opens at line 259 and closes at 323.
`this.auditService.record(BOOKING_AUDIT_ACTIONS.CREATED, …)` is at **line 335** — after the
transaction has already committed. The same shape recurs across all 19 files.

**The platform's established pattern is: commit the business mutation, then audit it
separately.** B8's contract inverts that — the audit must commit *within* the same
transaction. That inversion is the migration.

---

## Signature and semantics

```ts
// today, at all 361 sites
record(action: string, context: AuditContext, details?: AuditRecordDetails): Promise<void>

// what B8 requires
append(tx: Prisma.TransactionClient, event: AuditEventForAppend): Promise<AuditLogRecord>
```

| Difference | Migration impact |
| --- | --- |
| `tx` is required | **The blocker.** No caller has one. |
| Payload shape: three positional arguments vs one `event` object | Mechanical restructure |
| Return `Promise<void>` vs `Promise<AuditLogRecord>` | **None** — no caller uses the return value |
| Audit commits outside the business transaction vs inside it | **Behavioural.** See below. |

### The atomicity change nobody has decided yet

Today a failed audit write cannot roll back the business mutation — it happens afterwards, in
its own statement. After migration it can and will: the audit insert joins the transaction, so
an audit failure aborts the payment, the ride, the KYC decision.

That is arguably the point of a Class-A authoritative audit. It is also a change to the
failure semantics of **every audited operation on the platform**, and it needs a deliberate
ruling rather than arriving as a side effect of clearing a lint rule. It is the reason
"required behavior if transaction creation fails" cannot be answered per-caller from the code:
today the question does not arise, because there is no transaction.

---

## Proven breakage versus latent violation

The 22 failing tests are **a sample, not the blast radius.**

| Suite | Failures | Services exercised |
| --- | --- | --- |
| `wallet/partner-payout.spec.ts` | 13 | commission-account (3 sites), commercial-credit-settings (1), wallet-pin (2), delivery (1) |
| `delivery/rider-settlement.service.spec.ts` | 4 | rider-settlement — **0 own sites** |
| `messaging/messaging.service.spec.ts` | 3 | messaging (1 site) |
| `orders/merchant-direct-dispatch.e2e.spec.ts` | 2 | merchant-orders (6 sites), delivery (1) |

All four fail with the same Postgres error from B8's own trigger:

> `Legacy write boundary violated: all NULL authoritative fields rejected after P1-B2. Use append(tx, event) within Class-A transaction.`

**`rider-settlement.service.ts` contains zero `record()` calls yet its suite fails**, because
it depends on `WalletService` (5 sites) and `CommissionAccountService` (3). Breakage
propagates through service composition, so "which file calls `record()`" does not predict
"which feature breaks".

**These 22 are simply the paths the current suite happens to exercise against a migrated
database.** The other 339 production call sites are latent violations of the same trigger:
they will fail the first time they execute against a B8-migrated database. 245 of 256 suites
pass only because they never reach an audited write.

---

## What this means for scope

B8's `20260905_p1_b2_authoritative_boundary_and_global_sequence` migration installs a trigger
whose own comment states the intent: *"The frozen contract: ALL new writes MUST use
append(tx, event)… The deprecated create() path is disabled."*

So the deprecation is not advisory. **Applying B8's migrations to a database makes 361
production call sites across 30 domains throw at the database layer.** B8 cannot be deployed
against the existing platform until those callers are reconciled, regardless of anything else
on its branch.

That places the work firmly outside B8:

- It touches 77 production files in 30 domains, none of which B8 was authorized to change.
- It changes the failure semantics of every audited operation.
- It requires transaction boundaries to be designed where none exist.

**This should be a separate platform-wide workstream, not a B8 cleanup.** B8's own scope —
B8.2 foundation models and B8.3 archive engine — is unaffected by it.

---

## Options, not recommendations

Recorded for the architectural decision, deliberately not chosen here.

| Option | Shape | Cost | Risk |
| --- | --- | --- | --- |
| **A. Migrate all 361** | Introduce or extend a transaction at every audited operation and move the audit inside it | 77 files, 30 domains; every audited operation's failure semantics change | Highest. Also the only option that fully honours the Class-A contract as written |
| **B. Transaction-aware `AuditService`** | `record()` gains an optional `tx`; passes to `append()` when present, otherwise opens its own single-statement transaction | One file plus per-caller opt-in; callers migrate incrementally | Medium. A self-opened transaction satisfies the trigger but **not** the atomicity guarantee — the audit still commits separately, so it is Class-A in form only. Would need an explicit ruling that this is acceptable as an interim state |
| **C. Scope the trigger** | Restrict the boundary to the segments/actions B8 actually governs, leaving other writes legacy | Migration change only | Weakens the authoritative-audit contract B8 exists to establish. Would need B8's author to confirm the boundary was meant to be universal |
| **D. Sequence B8 behind the migration** | Treat the platform migration as a prerequisite and hold B8 until it lands | No code change now | Lowest technical risk; highest schedule cost. B8 stays on hold indefinitely |

Option B is the only one that offers an incremental path, and its weakness should be stated
plainly rather than discovered later: it removes the error without delivering the guarantee.

---

## Method and limits

- Transaction context determined by locating every `$transaction(` and its matching close via
  brace-depth scan, then testing each call-site offset for containment; and by searching the
  60 lines above each call for an enclosing signature taking `Prisma.TransactionClient`.
- Spot-checked against `bookings.service.ts`, where the transaction closes at 323 and the
  audit call is at 335 — outside, as the analysis reports.
- The analysis is static. It does not prove that a transaction *could not* be introduced at a
  given site, only that none exists today.
- Per-caller answers to "required behaviour if transaction creation fails" are not derivable
  from the code, because no caller currently creates one. That question belongs to the
  architectural decision above.
- Counts come from `eslint --format json` over `apps/backend/src`, so they reflect exactly what
  CI's lint step sees.
