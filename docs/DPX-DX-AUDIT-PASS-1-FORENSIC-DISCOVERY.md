# DPX-DX — Audit Forensic Discovery, Pass 1

**Status: READ-ONLY FORENSIC DISCOVERY. No code, migration, trigger, transaction-boundary or
caller change. DX PASS 1 COMPLETE → PASS 2 HOLD.**

Measured on `main` @ `3b63c28`, checked out clean and measured from zero. This is a **fresh DX
baseline**: no figure from the B8 forensic series was carried in, assumed, or used as a starting
point. The comparison against B8 in §9 was made only after the discovery was complete.

Scope deliberately wider than the B8 series, which looked only at `apps/backend/src`: this pass
searched `apps/`, `packages/`, `_e2e/` and `scripts/` — all eight applications and all seven
packages — before concluding where the audit surface lives.

---

## 1. The audit surface

**One service, one method, one write path.**

```
AuditService.record(action, context, details)        apps/backend/src/audit/audit.service.ts:23
  └─> AuditLogRepository.create(input)
        └─> PrismaAuditLogRepository.create()        .../repositories/prisma-audit-log.repository.ts:16
              └─> prisma.auditLog.create(...)
```

`AuditService` on `main` exposes **exactly one public method** — `record()`. There is no
`append()`, no segment/sequence/hash machinery, no second entry point.

Verified there is no bypass: `prisma.auditLog.<create|update|upsert|delete>` appears in exactly
**one** file in the entire repository, and that file is the repository implementation above. No
service writes `audit_logs` directly.

The service is injected under exactly **one** property name, `auditService`, in **77 files** —
and those same 77 files are precisely the ones containing call sites. Every audit write in
DrippleX goes through that one method.

**Where the surface is not.** Zero audit call sites outside `apps/backend`. The seven packages,
the seven front-end applications, `_e2e/` and `scripts/` contain none. Zero call sites in test or
spec files — specs assert against a mock rather than calling `record()`.

---

## 2. Denominator, discovered from zero

| Measure                                                  | Count   |
| -------------------------------------------------------- | ------- |
| Production `AuditService.record()` call sites            | **361** |
| Statically-named distinct actions                        | **294** |
| Additional actions reachable only through indirect sites | **35**  |
| **Distinct audit actions, total**                        | **329** |

Argument-expression shapes across the 361 sites:

| Shape                                           | Sites   | Resolvable at the site?      |
| ----------------------------------------------- | ------- | ---------------------------- |
| `X_AUDIT_ACTIONS.Y` constant                    | 335     | yes                          |
| String literal (`'integration.*'`)              | 12      | yes                          |
| Ternary on runtime state                        | 5       | no — resolved by reading     |
| Bare identifier (helper parameter)              | 5       | no — resolved at the callers |
| Object member (`actions.failed` / `.succeeded`) | 4       | no — resolved at the callers |
| **Total**                                       | **361** |                              |

The 294 named actions come from 30 constant modules (`AUTH_AUDIT_ACTIONS` 64, `DRIVER_` 41,
`RIDE_` 22, `ORDER_` 19, `MERCHANT_` 15 …) plus 7 string literals in the integrations module —
the only place in DrippleX where an audit action is an inline string rather than a named
constant.

**The 26 non-literal sites were resolved rather than collapsed.** They reach 36 distinct
constants; 35 of those are reachable _only_ this way, one (`DELIVERY_AUDIT_ACTIONS.LOCATION_UPDATED`)
also has a statically-resolvable site. Full resolution in §6.

---

## 3. Method, and what it can and cannot establish

Two stages, and the distinction matters for how much weight each number carries.

**Stage 1 — type-resolved static screen (all 361 sites).** For each site: locate the enclosing
method and the enclosing _class_ (attributed by position, so a file holding an abstract base and
its implementation resolves correctly); scan the text before the record call for a Prisma write,
a Redis mutation, or a call to a collaborator; resolve each collaborator through the class's
constructor injections to its declared type, then to the concrete class (`X` → `PrismaX` or the
class declaring `implements X`), and scan that method — recursing up to three levels, always
through resolved types.

**Resolution is by type, never by bare method name.** An earlier name-keyed version of this
analysis was discarded: with 30+ services sharing method names like `create` and `update`, name
collisions produced false "mutation found" verdicts at depth ≥ 2. None of those results are used
here.

**Stage 2 — hand verification of every boundary site (54 sites).** Everything the screen did not
mark as a direct Prisma write immediately before the record — all 33 no-mutation, all 8 Redis,
and all 13 delegated-at-depth-≥2 — was read by hand. Corrections in §4.1.

**The limit, stated plainly.** The screen is **branch-insensitive**: it reads the method text
lexically before the record call, which includes sibling branches that returned or threw and can
never reach it. This produces false positives in both directions, and it is why every boundary
site was hand-read. The **219 sites with a direct Prisma write immediately before the record were
screened, not individually hand-read** — they carry less certainty than the 54, and a small
number may be branch artifacts. Pass 2 should hand-read them before any of them is ratified.

---

## 4. Mutation classification

### 4.1 Site level (361 sites, boundary hand-verified)

| Result                                                                         | Sites   |
| ------------------------------------------------------------------------------ | ------- |
| Mutates **Postgres** — directly, via a collaborator, or via its callers        | **320** |
| Mutates **Redis only** — no Postgres write on the path                         | **9**   |
| Mutates Redis in-method, Postgres **in the caller** (`profile.service.ts:279`) | **1**   |
| **No mutation** — genuinely observational or a refusal                         | **31**  |
| **Total**                                                                      | **361** |

Five hand corrections were applied to the screen, each from reading the code:

| Site                                                                  | Screen said   | Verified                    | Why                                                                                                                                               |
| --------------------------------------------------------------------- | ------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth/services/otp.service.ts:136` `OTP_VERIFIED`                     | Postgres (d3) | **Redis only**              | The screen reached `recordFailedAttempt` through the _failure_ branch, which throws. The reachable path performs `redis.del` ×3 and nothing else. |
| `auth/services/refresh.service.ts:101` `REFRESH_FAILED`               | Postgres (d2) | **No mutation**             | Same shape: `handleReuseDetected` sits in the `!hashMatches` branch, which throws before this line.                                               |
| `auth/services/login.service.ts:306` `LOGIN_FAILED`                   | No mutation   | **Redis**                   | Preceded by `loginAttemptService.recordFailure`, which increments the Redis lockout counters.                                                     |
| `delivery/delivery.service.ts:1053`, `rides/ride-trip.service.ts:267` | No mutation   | **Postgres, in the caller** | Private audit helpers. The mutation is committed by each caller before the helper is invoked.                                                     |

### 4.2 Action level (294 statically-named actions)

| Result                      | Actions |
| --------------------------- | ------- |
| All sites mutate Postgres   | **273** |
| All sites mutate Redis only | **6**   |
| All sites observational     | **10**  |
| **Sites disagree**          | **5**   |

The **10 confirmed-observational actions** — the Class B candidates that need no ratification
argument:

```
AUTH_AUDIT_ACTIONS.GOOGLE_LOGIN_STARTED    AUTH_AUDIT_ACTIONS.LOGIN_STARTED
AUTH_AUDIT_ACTIONS.PASSWORD_RESET_FAILED   AUTH_AUDIT_ACTIONS.PASSWORD_RESET_STARTED
AUTH_AUDIT_ACTIONS.REFRESH_FAILED          AUTH_AUDIT_ACTIONS.REFRESH_STARTED
AUTH_AUDIT_ACTIONS.SESSION_LIST            PAYMENT_AUDIT_ACTIONS.WEBHOOK_RECEIVED
PAYMENT_AUDIT_ACTIONS.WEBHOOK_REJECTED     integration.test
```

The **5 mixed actions** — the same action name recorded on both a mutating and a non-mutating
path. These cannot be classified as one thing; they either need splitting or need per-site
handling:

| Action                                         | Shape                                                                             |
| ---------------------------------------------- | --------------------------------------------------------------------------------- |
| `AUTH_AUDIT_ACTIONS.EMAIL_VERIFICATION_FAILED` | 5 sites are pure refusals; 1 (`:141`) follows a committed `incrementAttemptCount` |
| `AUTH_AUDIT_ACTIONS.PHONE_VERIFICATION_FAILED` | same shape                                                                        |
| `AUTH_AUDIT_ACTIONS.VERIFICATION_EXPIRED`      | same shape                                                                        |
| `AUTH_AUDIT_ACTIONS.PASSWORD_CHANGE_FAILED`    | 2 refusals; 1 in the outer catch, downstream of committed writes                  |
| `AUTH_AUDIT_ACTIONS.OTP_FAILED`                | 1 refusal (`:116`); 1 after a Redis counter increment (`:214`)                    |

**This is a genuine mixed-action finding, and it is the opposite of the B8 one.** In the B8
matrix the "mixed action" turned out to be an extraction artifact. Here, five real action names
are each used in two semantically different shapes. Whether they need splitting is a business
question for Pass 2, not an engineering one.

---

## 5. The Redis-only cohort — the policy gap is not one action

**9 distinct actions across 9 sites mutate Redis and never touch Postgres.** A tenth site,
`profile.service.ts:279`, mutates Redis here and Postgres in its caller — it is the ordering
defect of §8, not a member of this cohort.

| Action                                              | Sites                    | Redis state changed                             |
| --------------------------------------------------- | ------------------------ | ----------------------------------------------- |
| `AUTH_AUDIT_ACTIONS.OTP_VERIFIED`                   | `otp.service.ts:136`     | OTP burned (`del` ×3) — makes replay impossible |
| `AUTH_AUDIT_ACTIONS.OTP_SENT`                       | `otp.service.ts:91`      | OTP hash stored with TTL                        |
| `AUTH_AUDIT_ACTIONS.OTP_FAILED`                     | `otp.service.ts:214`     | attempt counter incremented, lockout set        |
| `AUTH_AUDIT_ACTIONS.LOGIN_FAILED`                   | `login.service.ts:306`   | brute-force lockout counters incremented        |
| `AUTH_AUDIT_ACTIONS.PASSWORD_FORGOT`                | `password.service.ts:59` | forgot-password rate-limit counter              |
| `AUTH_AUDIT_ACTIONS.PROFILE_EMAIL_CHANGE_REQUESTED` | `profile.service.ts:195` | pending-change record with TTL                  |
| `AUTH_AUDIT_ACTIONS.PROFILE_PHONE_CHANGE_REQUESTED` | `profile.service.ts:138` | pending-change record with TTL                  |
| `AUTH_AUDIT_ACTIONS.PROFILE_EMAIL_CHANGE_FAILED`    | `profile.service.ts:264` | lockout set, pending record mutated             |
| `AUTH_AUDIT_ACTIONS.PROFILE_PHONE_CHANGE_FAILED`    | `profile.service.ts:249` | lockout set, pending record mutated             |

Every one is security-state. None has a Postgres transaction to be atomic with, and the standing
rule is that Redis is never the audit authority — so the Class A guarantee cannot be constructed
for any of them as the code stands.

**The `OTP_VERIFIED` ruling already outstanding on B8 is therefore not a single-action decision.**
Whatever is decided — Class B, durable Postgres-backed consumption, or a third class — applies to
a cohort of 9 actions across 9 sites spanning the whole authentication surface, all of it lockout, OTP and
pending-change state. That materially changes the cost of options (b) and (c).

---

## 6. Runtime-selected and indirect actions (26 sites → 36 constants)

Three shapes, only one of which varies at runtime:

**Genuine runtime branch — 5 sites, 11 constants.** All five sit after a committed mutation.

| Site                                             | Selects between                                                  |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| `drivers/inspections/inspections.service.ts:277` | `DRIVER_AUDIT_ACTIONS.INSPECTION_PASSED` / `INSPECTION_FAILED`   |
| `fleets/fleets.service.ts:189`                   | `FLEET_AUDIT_ACTIONS.REGISTERED` / `CREATED`                     |
| `wallet/wallet.service.ts:535`                   | `WALLET_AUDIT_ACTIONS.CREDITED` / `DEBITED`                      |
| `wallet/wallet.service.ts:717`                   | `WALLET_AUDIT_ACTIONS.HELD` / `HOLD_COMMITTED` / `HOLD_RELEASED` |
| `commercial/commission-account.service.ts:542`   | `COMMERCIAL_AUDIT_ACTIONS.BLOCKED` / `UNBLOCKED`                 |

**Helper indirection — 5 sites, 21 constants.** A private helper takes `action: string`; every
caller passes a constant, verified caller by caller. Nothing varies at runtime.

`bookings.unwind` (2), `bookings.transitionBooking` (3), `delivery.auditLifecycle` (11 constants
over 12 callers), `fraud.reviewWithAudit` (2), `ride-trip.audit` (3).

**Action-set indirection — 4 sites, 4 constants.** `profile.confirmPendingChange` takes an
`{requested, failed, succeeded}` literal; the caller (email or phone) fixes which.

None of the 26 needs a new action name — every constant already exists and is distinct.
`WALLET_AUDIT_ACTIONS.CREDITED` / `DEBITED` is the consequential pair: every wallet credit and
debit in DrippleX flows through the single site `wallet.service.ts:535`.

---

## 7. Transaction boundaries — the headline structural finding

> **Not one of the 361 audit records is written inside a `$transaction` callback.**

Checked by balanced-paren span rather than by proximity: for every site, whether its byte offset
falls inside the argument list of a `$transaction(` call. The result is zero.

| Position                                                           | Sites  |
| ------------------------------------------------------------------ | ------ |
| Inside a `$transaction` callback                                   | **0**  |
| In a method that opens a `$transaction`, recorded after it commits | **31** |
| In a file that uses `$transaction`, unrelated method               | 50     |
| In a file with no `$transaction` at all                            | 280    |

Every audit write in DrippleX today is a **separate, post-hoc, non-atomic** write. If the audit
insert fails, the business mutation stands and is unrecorded; nothing currently prevents that for
any action, financial ones included.

The **31 sites already inside a transaction-opening method** are the cheapest possible Class A
remediation: the boundary exists and the record only has to move inside it. They include the
financially significant ones —

```
wallet/wallet.service.ts:253 (TRANSFERRED)   :535 (CREDITED/DEBITED)   :717 (HELD/…)
commercial/commission-account.service.ts:229 (PAYMENT_RECORDED)
loyalty/loyalty.service.ts:191, :263, :430   promotions/promotions.service.ts:792, :949
users/account-deletion.service.ts:254 (ACCOUNT_DELETED)
```

The remaining 289 would each need a transaction introduced — a materially different cost, and the
number Pass 2's scoping should be built on.

---

## 8. Ordering defects

Sites where the audit record is committed before the mutation it asserts. The automated "write
after the record" screen was **discarded as unusable** — branch-insensitivity made almost all 48
of its hits sibling branches. Every entry below was established by reading.

**Genuine defect — a completion event recorded before its own mutation:**

1. **`PROFILE_EMAIL_CHANGED` / `PROFILE_PHONE_CHANGED`** — `auth/services/profile.service.ts:279`.
   `confirmPendingChange` records the _success_ action and returns; only then does the caller run
   `usersService.updateEmail` (`:215`) or `updatePhone` (`:158`). **If that update throws, the
   audit log carries an address change that never happened.** Flagged, not fixed.

**By design — intake events, correct as they stand, listed so they are not mistaken for defects:**

2. `PASSWORD_FORGOT` (`password.service.ts:59`) — recorded unconditionally at the top, including
   for an email matching no account; the token writes follow. It documents the request, not the
   issuance.
3. `PASSWORD_RESET_STARTED` (`:102`), `LOGIN_STARTED` (`login.service.ts:132`), `REFRESH_STARTED`
   (`refresh.service.ts:30`), `GOOGLE_LOGIN_STARTED` (`google-auth.service.ts:61`) — all
   `*_STARTED` intake records at method entry. The committed outcome is covered by a separate
   action in each case.

If any of items 2–3 is ever promoted to Class A, the record must move after the write it would
then be asserting.

---

## 9. Comparison with the B8 forensic universe

Made **after** the discovery above was complete, and reported separately so it cannot be mistaken
for an input to it.

| Measure                 | DX `main` @ `3b63c28` | B8 `b8-sync` @ `002feaf` |
| ----------------------- | --------------------- | ------------------------ |
| Production call sites   | 361                   | 361                      |
| Distinct actions        | 329                   | 329                      |
| Statically-named        | 294                   | 294                      |
| Reached only indirectly | 35                    | 35                       |

**They are the same universe.** This is the expected result and it is worth having measured: B8's
changes are confined to `src/audit` infrastructure, migrations and tests, and touch none of the
361 caller sites. The B8 caller figures were therefore measured on a baseline that faithfully
represents `main`.

Two things DX Pass 1 establishes that the B8 series did not:

- **The transaction-boundary finding (§7)** — zero records inside a transaction, 31 cheap
  remediation targets. B8's work never measured this repo-wide.
- **The Redis cohort (§5)** — the `OTP_VERIFIED` policy question governs 7 actions across 10
  sites, not one action.

And one correction of emphasis: the B8 matrix's "mixed action" was an artifact, but DX has **five
genuinely mixed actions** (§4.2) that the B8 series never surfaced, because they are mixed across
_sites of the same named constant_ rather than within one expression.

---

## 10. Required outputs, collected

| Output                        | Result                                                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Distinct action count         | **329**                                                                                                                                       |
| Call-site count               | **361**                                                                                                                                       |
| Class A candidates            | **320 sites / 304 actions** with a committed Postgres mutation — significance not yet ratified (273 statically named + 31 reached indirectly) |
| Class B candidates            | **31 sites / 10 actions** confirmed observational                                                                                             |
| Unresolved / policy gap       | **9 actions, 9 sites** Redis-only (§5), plus the 5 mixed actions of §4.2                                                                      |
| Runtime-selected actions      | **5 sites → 11 constants**; plus 21 via helper and object indirection (§6)                                                                    |
| Hidden collaborator mutations | **101 sites** mutate only through a collaborator, invisible to a same-method scan                                                             |
| Ordering defects              | **1 genuine** (`PROFILE_*_CHANGED`); 5 intake-by-design (§8)                                                                                  |
| Transaction-boundary findings | **0 inside a transaction**; 31 cheap targets; 289 needing a new boundary (§7)                                                                 |

---

## 11. Gate

**DX PASS 1: COMPLETE · DX PASS 2: HOLD**

Nothing here is implementation authorization. No code, migration, trigger, transaction-boundary
or caller change has been made, and none is proposed.

B8 remains frozen and untouched by this pass: `b8-sync` local at `002feaf`,
`claude/p1-b8-archive-purge-6o3vb8` at `a152a25`, PR #351 unmodified, `ca3b8b5` unamended. No
evidence in this document establishes an interaction between the two workstreams.

Before Pass 2, three engineering items and three business items:

**Engineering (read-only, unauthorized):**

1. Hand-read the 219 screened-only sites (§3), since branch-insensitivity means a minority may be
   misclassified.
2. Resolve the 5 mixed actions (§4.2) — split, or handle per site.
3. Confirm the 31 in-transaction remediation targets individually (§7).

**Business (rulings needed):**

1. Significance ratification for the 304 mutating actions — the Class A/B boundary itself.
2. The Redis cohort ruling (§5), which subsumes the outstanding `OTP_VERIFIED` question.
3. Whether the 5 mixed actions should be split into distinct names.
