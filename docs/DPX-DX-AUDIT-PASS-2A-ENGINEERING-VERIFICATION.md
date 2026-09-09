# DPX-DX — Audit Forensic, Pass 2A: Read-Only Engineering Verification

**Status: READ-ONLY · NO CODE · NO MIGRATIONS · NO TRIGGERS · NO TRANSACTION CHANGES · NO CALLER
CHANGES. DX PASS 2A COMPLETE → HOLD.**

Measured on the same tree as Pass 1 — `main` @ `3b63c28`, byte-identical on this branch. The
accepted Pass-1 baseline `89c7aff` is left intact; every correction to it is recorded here
instead of amended into it.

Seven authorized items, all seven executed. Recommendations in §6 are engineering
recommendations. **They are not ratification.**

---

## 0. Corrections to the Pass-1 baseline

Pass 2A changes four Pass-1 numbers. Each is a hand-verified correction, not a re-measurement.

| Figure                                | Pass 1 | Pass 2A | Why                                                                                                     |
| ------------------------------------- | ------ | ------- | ------------------------------------------------------------------------------------------------------- |
| Postgres-mutating sites               | 320    | **318** | `phone-verification.service.ts:116` is Redis, not Postgres; `password.service.ts:224` is path-dependent |
| Redis-mutating sites                  | 9 (+1) | **11**  | adds `phone-verification.service.ts:116`                                                                |
| Path-dependent sites                  | —      | **1**   | new category, see §2                                                                                    |
| Sites in a transaction-opening method | 31     | **32**  | Pass 1 missed `driver-identity-verification.service.ts:519`                                             |
| Mutating sites without a boundary     | 289    | **286** | follows from the above                                                                                  |

Observational sites (31), call sites (361) and distinct actions (329) are unchanged.

The 32/286 correction matters for scoping: the cheap population is one larger and the expensive
one three smaller than Pass 1 reported.

---

## 1. Item 1 — direct-write verification, 219 sites

**Result: all 219 confirmed on the execution path. Zero branch-sensitive false positives.**

This was the item most likely to move numbers, and it moved none.

**Method.** Rather than eyeball 219 methods, the check was made structural and then hand-read
where structure was insufficient. For each site: blank out string, template and comment content
so their braces cannot be miscounted; locate the method body's opening brace as the first `{` at
angle-depth 0 after the parameter list closes (a naive "first `{`" lands inside object-typed
parameters such as `input: { ownerUserId: string }` and truncates the span — that bug was found
and fixed, and it had silently hidden 48 sites); brace-match the body; then for each Prisma write
before the record, find every block containing the write but **not** the record. If such a block
ends in `throw`/`return`, reaching the record proves the block was never entered and the write
never executed.

One refinement was necessary. A `$transaction(async (tx) => { … return created; })` callback ends
in `return`, but that returns from the _callback_, not the method — treating it as a control-flow
exit produced 12 false "not on path" verdicts. Blocks opened by `=>` or `function` are therefore
excluded from the exit test.

| Verdict                                | Sites |
| -------------------------------------- | ----- |
| Write structurally on the path         | 200   |
| Conditional — resolved by hand reading | 19    |
| Write provably off the path            | **0** |

All 19 conditionals resolved to _on the path_, in three shapes:

- **Awaited `$transaction` callback** (12) — `cms.service.ts:57,143,180,225`,
  `fleet-commission.service.ts:428`, `fleets.service.ts:189,404`, `loyalty.service.ts:191,263,430`,
  `account-deletion.service.ts:254`, `wallet.service.ts:717`. If the awaited call returned, the
  callback ran.
- **`try` block whose `catch` rethrows** (5) — `bookings.service.ts:335`,
  `vehicles.service.ts:68`, `driver-campaign.service.ts:114`, `promotions.service.ts:792,949`.
  Reaching the record proves the write succeeded.
- **`if`/`else` where both branches mutate** (2) — `utilities.service.ts:844` (`reverse()` or a
  direct `utilityPurchase.update`), `rides.service.ts:603`.

**What this establishes and what it does not.** The 219 no longer carry the Pass-1 caveat: their
mutations are real and reachable. It does **not** establish significance — only that there is a
committed mutation to be significant about.

---

## 2. Item 2 — the five mixed actions, classified site by site

Confirmed genuinely mixed, and the mix is sharper than Pass 1 could see. **19 sites across 5
action names.** Site-level classification is not a convenience here; three of the five carry
different meanings on different paths.

### `AUTH_AUDIT_ACTIONS.VERIFICATION_EXPIRED` — 2 sites, the clearest case

| Site                               | Preceding                                                             | Class           |
| ---------------------------------- | --------------------------------------------------------------------- | --------------- |
| `email-verification.service.ts:98` | nothing                                                               | **B**           |
| `phone-verification.service.ts:93` | `verificationRepository.markConsumed` → `identityVerification.update` | **A candidate** |

The same action name is observational in the email flow and authoritative in the phone flow,
because only the phone flow burns the challenge before recording. One name, two meanings.

### `AUTH_AUDIT_ACTIONS.PHONE_VERIFICATION_FAILED` — 6 sites, three different classes

| Site                      | Preceding                             | Class           |
| ------------------------- | ------------------------------------- | --------------- |
| `:64` unknown phone       | nothing                               | **B**           |
| `:83` no active challenge | nothing                               | **B**           |
| `:102` OTP expired        | `markConsumed` (Postgres)             | **A candidate** |
| `:116` attempts exceeded  | `redis.set(lockKey)` — **Redis only** | **Policy gap**  |
| `:138` invalid OTP        | `incrementAttemptCount` (Postgres)    | **A candidate** |
| `:152` OTP reused         | `incrementAttemptCount` (Postgres)    | **A candidate** |

`:116` was Pass 1's screen calling Postgres; hand reading shows the `markConsumed` it saw is in
the sibling expiry branch, which throws. It belongs to the Redis cohort of §3.

### `AUTH_AUDIT_ACTIONS.EMAIL_VERIFICATION_FAILED` — 6 sites

`:68`, `:78`, `:85`, `:110`, `:123` are pure refusals → **B**. `:141` follows
`incrementAttemptCount` → **A candidate**.

### `AUTH_AUDIT_ACTIONS.OTP_FAILED` — 2 sites

`otp.service.ts:116` (expired, nothing written) → **B**. `otp.service.ts:214` (after `redis.incr`

- `redis.expire`) → **Policy gap**, §3.

### `AUTH_AUDIT_ACTIONS.PASSWORD_CHANGE_FAILED` — 3 sites, and a new category

`:176` and `:185` are pre-mutation refusals → **B**. `:224` sits in the method's **outer
`catch`**, reachable from anywhere inside the `try` — including after `usersService.updatePassword`
and `authSessionRepository.revokeAllForUser` have already committed.

**This site is neither A nor B: it is path-dependent.** Whether a mutation preceded it depends on
where the throw originated, and that cannot be decided statically or by splitting the name. It is
the only such site in the codebase and is recorded as its own category.

---

## 3. Item 3 — the Redis-only cohort, analysed as one policy population

**11 sites. 10 action names, 9 of them exclusively Redis.** All of it authentication and
account-security state.

| Action                           | Site                                | State mutated                                  | Authoritative?                             | If the audit write fails                      | Durable state to join?                                             |
| -------------------------------- | ----------------------------------- | ---------------------------------------------- | ------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------ |
| `OTP_VERIFIED`                   | `otp.service.ts:136`                | OTP key + attempt + lockout keys deleted       | **Yes** — the burn is what prevents replay | OTP is spent, no record it was ever presented | **No**                                                             |
| `OTP_SENT`                       | `otp.service.ts:91`                 | OTP hash stored with TTL                       | Yes — the credential now exists            | A live credential exists unrecorded           | **No**                                                             |
| `OTP_FAILED`                     | `otp.service.ts:214`                | attempt counter `incr`, lockout `set`          | Yes — drives lockout                       | Lockout advanced with no trail                | **No**                                                             |
| `LOGIN_FAILED`                   | `login.service.ts:306`              | brute-force counters per email and per IP      | Yes — drives account lockout               | Same                                          | **No**                                                             |
| `PHONE_VERIFICATION_FAILED`      | `phone-verification.service.ts:116` | verification lockout key set                   | Yes                                        | Same                                          | **No**                                                             |
| `PASSWORD_FORGOT`                | `password.service.ts:59`            | forgot-password rate-limit counter             | Partly — throttle only                     | Throttle advanced with no trail               | **Yes** — `PasswordResetToken` is written later in the same method |
| `PROFILE_EMAIL_CHANGE_REQUESTED` | `profile.service.ts:195`            | pending-change record + TTL                    | Yes — this _is_ the pending change         | A pending email change exists unrecorded      | **No**                                                             |
| `PROFILE_PHONE_CHANGE_REQUESTED` | `profile.service.ts:138`            | pending-change record + TTL                    | Yes                                        | Same                                          | **No**                                                             |
| `PROFILE_PHONE_CHANGE_FAILED`    | `profile.service.ts:249`            | lockout set / pending record rewritten         | Yes                                        | Same                                          | **No**                                                             |
| `PROFILE_EMAIL_CHANGE_FAILED`    | `profile.service.ts:264`            | lockout set / pending record rewritten         | Yes                                        | Same                                          | **No**                                                             |
| `PROFILE_{EMAIL,PHONE}_CHANGED`  | `profile.service.ts:279`            | Redis cleanup here; **Postgres in the caller** | Yes                                        | see §5 — this is the ordering defect          | Yes, in the caller                                                 |

**Findings for the policy decision.**

1. **The cohort is coherent.** Every member is OTP lifecycle, lockout counters, or pending
   identity-change state. There is no unrelated straggler; a single ruling covers all of it.
2. **Nine of the eleven have no durable state to join.** Option (b) — durable Postgres-backed
   consumption — is not one schema addition. It would require a persisted OTP-lifecycle model, a
   persisted lockout model, and a persisted pending-identity-change model, each with its own TTL
   and cleanup semantics that Redis currently provides for free.
3. **`PASSWORD_FORGOT` is the exception** and cuts the other way: `PasswordResetToken` is written
   _later in the same method_. A boundary exists; the record simply precedes it (§5).
4. **The failure mode is uniform and consequential**: the security state advances and no record
   survives. For lockout counters that means an account can be locked with nothing in the log
   saying why.

**Engineering observation, not a recommendation:** the cohort splits naturally into
_credential-lifecycle_ (OTP sent/verified/failed, pending changes) and _throttle-and-lockout_
(login failures, rate limits). They differ in weight — the first is about what a user proved, the
second about what the platform decided to do about repeated failure — and the founder may wish to
rule differently on each rather than treat all eleven alike.

---

## 4. Item 4 — the 32 sites with an existing transaction boundary

**Pass 1 said 31; it is 32.** `driver-identity-verification.service.ts:519` was missed there.

All 32 share one relationship, verified by balanced-paren span in Pass 1 and re-checked here:

> The method opens `prisma.$transaction(...)`, the callback performs the business mutation, the
> transaction commits, **and the audit record is written after the awaited call returns.**

The boundary already exists. The remediation shape is _move the record inside the callback_ — no
new transaction, no signature change, no threading through layers.

```
bookings/bookings.service.ts:335            operations/operations-cases.service.ts:419,430,441
bookings/room-inventory.service.ts:276      products/merchant-products.service.ts:303
cms/cms.service.ts:57,143,180,225           promotions/promotions.service.ts:792,949
commercial/commission-account.service.ts:229 referrals/driver-campaign.service.ts:114
drivers/drivers.service.ts:192              rides/ride-dispatch.service.ts:210
drivers/identity-verification/…:519,554,565 rides/ride-trip.service.ts:245
fleets/fleet-commission.service.ts:428      rides/rides.service.ts:520,603
fleets/fleets.service.ts:189,404            users/account-deletion.service.ts:254
loyalty/loyalty.service.ts:191,263,430      wallet/wallet.service.ts:253,535,717
```

**Three of the 32 need a note.** `commission-account.service.ts:229`, `wallet.service.ts:253` and
`wallet.service.ts:535` build their audit metadata from the value the transaction _returns_
(`result.account.id`, `result.source.wallet.id`). Moving the record inside means computing that
metadata within the callback. Still local, still no signature change — but not a pure line move,
and worth knowing before anyone estimates it as one.

**These 32 carry the financial cluster**: `WALLET.TRANSFERRED`, `CREDITED`/`DEBITED`,
`HELD`/`HOLD_COMMITTED`/`HOLD_RELEASED`, `COMMERCIAL.PAYMENT_RECORDED`, all three `LOYALTY` point
movements, both `PROMOTION.REDEEMED` sites, and `USER.ACCOUNT_DELETED`.

---

## 5. Item 5 — the ordering defect, confirmed

**Confirmed. One defect. Documented, not fixed.**

```
profile.service.ts:219  confirmPendingChange(kind, userId, otp, context, actions)
  :276-277    await this.redis.del(pendingKey); await this.redis.del(lockKey);
  :279        await this.auditService.record(actions.succeeded, …)   ← the record
  :285        return pending.value;                                   ← method returns

profile.service.ts:152  confirmPhoneChange → :158  await this.usersService.updatePhone(userId, newPhone)
profile.service.ts:209  confirmEmailChange → :215  await this.usersService.updateEmail(userId, newEmail)
```

`actions.succeeded` resolves to `AUTH_AUDIT_ACTIONS.PROFILE_PHONE_CHANGED` or
`PROFILE_EMAIL_CHANGED` depending on the caller.

**Failure mode.** `updateEmail` / `updatePhone` is a `user.update`. It can fail on a unique
constraint — the window between the `findByEmail` uniqueness check in `requestEmailChange` and
this write is unguarded, so another account can claim the address in between — or on any
connection-level error. When it does:

- the audit log contains `PROFILE_EMAIL_CHANGED` for that user at that timestamp;
- `users.email` still holds the old address;
- the Redis pending record has already been deleted at `:276`, so the change cannot be retried
  and no compensating record is written;
- the caller's exception propagates and the user sees a failure — while the log says it succeeded.

**The defect is the ordering, not the transaction.** Even under a Class A regime the record would
be wrong here, because it is recorded in a different method from the mutation it asserts. Moving
the record to the caller, after the update, fixes it independently of any classification.

No fix is proposed or applied. Recorded for founder confirmation.

---

## 6. Item 6 — proposed classification matrix

**Engineering recommendations. Not ratification.** "Class A candidate" below means _a committed
mutation exists to be atomic with_ — never that the event has been judged significant enough to
warrant it. That judgement is the business decision this pass exists to inform.

### Site level — 361

| Class                                         | Sites   | Basis                                                         |
| --------------------------------------------- | ------- | ------------------------------------------------------------- |
| **A candidate** — committed Postgres mutation | **318** | verified on-path (§1) or through a type-resolved collaborator |
| **B** — no mutation                           | **31**  | reads, refusals, intake records                               |
| **Policy gap** — Redis-only                   | **11**  | §3                                                            |
| **Path-dependent** — neither                  | **1**   | `password.service.ts:224` (§2)                                |

### Action level — 329

| Class                                                                     | Actions                 |
| ------------------------------------------------------------------------- | ----------------------- |
| A candidate — every site mutates                                          | **304**                 |
| B — no site mutates                                                       | **10**                  |
| Policy gap — Redis-only at every site                                     | **9**                   |
| **Mixed — must be classified per site**                                   | **5**                   |
| Sub-total, named                                                          | 328                     |
| `PROFILE_{EMAIL,PHONE}_CHANGED` — A candidate **and** the ordering defect | (2, counted in the 304) |

The 10 confirmed Class B actions:

```
AUTH.GOOGLE_LOGIN_STARTED   AUTH.LOGIN_STARTED         AUTH.PASSWORD_RESET_FAILED
AUTH.PASSWORD_RESET_STARTED AUTH.REFRESH_FAILED        AUTH.REFRESH_STARTED
AUTH.SESSION_LIST           PAYMENT.WEBHOOK_RECEIVED   PAYMENT.WEBHOOK_REJECTED
integration.test
```

### Recommendations

1. **Ratify the 10 Class B actions as Class B.** They are reads, refusals and `*_STARTED` intake
   records. Nothing is committed; there is nothing for an audit write to be atomic with. This is
   the one group where engineering has no residual doubt.
2. **Do not ratify the 304 as one block.** The mutation is established; the significance is not,
   and it ranges from a wallet debit to a wishlist reorder.
3. **Classify the 5 mixed actions per site**, as §2 sets out — 19 sites, of which 8 are A
   candidates, 9 are B, 1 is policy-gap and 1 is path-dependent. Renaming is an alternative for
   `VERIFICATION_EXPIRED` and `PHONE_VERIFICATION_FAILED`, whose paths differ enough that one
   name is arguably wrong regardless of class.
4. **Rule on the Redis cohort as a cohort**, with the credential-lifecycle / throttle-and-lockout
   split of §3 available if the two deserve different answers.
5. **Treat `password.service.ts:224` separately.** A catch-all handler cannot be classified; if
   the surrounding operation is ratified Class A, this site needs a different construction, not a
   different label.
6. **Fix the ordering defect independently of classification** (§5). It is wrong under either
   class.

---

## 7. Item 7 — cost characterization of the 286 sites without a boundary

**286 Postgres-mutating sites have no transaction to join.** This is the population that would
have to acquire one if the corresponding actions are ratified Class A. Characterized read-only,
into the three bands authorized, with no boundary designed.

| Band                            | Sites   | What it would take                                                                                                                                                                                                                                                                                                    |
| ------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cheap — local**               | **188** | Every mutation on the path is a direct `this.prisma.<model>.<op>` in the same method. A `$transaction` can be opened locally around writes already adjacent, and the record moved inside. No signature changes, no cross-layer plumbing.                                                                              |
| **Cheap — repository-owned**    | **54**  | The mutation is one call into an injected repository. Repositories in this codebase already sit directly on `PrismaService`, so the standard shape — an optional `tx` client parameter — is available without restructuring. Cheap, but it does change a repository signature, so it is not free the way the 188 are. |
| **Structural**                  | **32**  | The mutation is owned by another **service**, not a repository. A transaction context would have to cross a service boundary, and in several cases coordinate more than one service.                                                                                                                                  |
| **Needs further investigation** | **12**  | Insufficient evidence to characterize safely.                                                                                                                                                                                                                                                                         |

**242 of 286 — 85% — are cheap in the sense that matters**: no transaction context crosses a
service boundary.

### The 32 structural sites

Concentrated in two places. **21 are in `auth/`** — `email-verification`, `phone-verification`,
`password`, `google-auth`, `login`, `profile`, `refresh`, `registration` — where the mutation
belongs to `UsersService` and the auditing service only orchestrates. **The other 11 cross a
service boundary for a business reason**, and these are the expensive ones:

```
payments/payment.service.ts:243   PAYMENT.INITIALIZED    → walletService.debit
payments/payment.service.ts:942   PAYMENT.REFUNDED       → walletService.refund
utilities/utilities.service.ts:337 UTILITIES.PURCHASE_INITIATED → walletService.debit
wishlist/wishlist.service.ts:307  WISHLIST.MOVED_TO_CART → cartService.addItem
orders/checkout.service.ts:211    ORDER.CREATED          → reservationService.reserve + pricingService
orders/checkout.service.ts:355    ORDER.CANCELLED        → reservationService.releaseForOrder
cart/cart.service.ts:310          CART.RECALCULATED      → pricingService.computeTotals
notification-center/…:214,235,249,259  preferences/template services
```

`PAYMENT.REFUNDED` and `PAYMENT.INITIALIZED` are the ones to weigh: both are financially
significant, both delegate the money movement to `WalletService`, and `WalletService` already
opens its own transaction internally. Making the audit atomic with the wallet mutation would mean
either passing a caller-owned `tx` into `WalletService` or moving the audit responsibility into
it. **That is a design decision, and Pass 2A does not make it.**

### The 12 needing investigation

Five are the helper-parameter sites of Pass 1 §6 — the mutation is in each _caller_, so the
boundary question has to be asked per caller, not per site: `bookings.service.ts:703,1072`,
`delivery.service.ts:1053`, `fraud.service.ts:386`, `ride-trip.service.ts:267`. The other seven
have mutations reached through a chain the type-resolved analysis followed but which needs
reading before any boundary claim: `notification-center:297,322`, `payment.service.ts:299,331`,
`ride-payment.service.ts:287`, `utilities.service.ts:284`, `wallet.service.ts:488`.

### What this means for the Class A decision

| If ratified Class A…             | Sites | Character                                                    |
| -------------------------------- | ----- | ------------------------------------------------------------ |
| The 32 with an existing boundary | 32    | move the record inside; 3 need metadata computed in-callback |
| The 188 local                    | 188   | open a local transaction                                     |
| The 54 repository-owned          | 54    | add an optional `tx` parameter to the repository method      |
| The 32 structural                | 32    | a cross-service transaction design decision                  |
| The 12 unknown                   | 12    | investigate first                                            |

**The shape of the remediation is therefore: overwhelmingly local, with a small, identifiable
expensive core of 11 genuinely cross-service sites — concentrated in payments, wallet,
checkout and cart.** That core, not the 286, is what should drive the affordability judgement.

---

## 8. Gate

**DX PASS 2A: COMPLETE → HOLD.**

Nothing here is implementation authorization. No code, migration, trigger, transaction-boundary or
caller change was made, and none is proposed. The recommendations in §6 are engineering opinion
offered for ratification, not decisions taken.

Containment unchanged:

|                                     |                                              |
| ----------------------------------- | -------------------------------------------- |
| `b8-sync`                           | `002feaf`, local only, clean — **B8 frozen** |
| `claude/p1-b8-archive-purge-6o3vb8` | `a152a25`, untouched                         |
| PR #351                             | untouched                                    |
| `ca3b8b5`                           | B8 Pass-1 baseline, unamended                |
| `89c7aff`                           | DX Pass-1 baseline, unamended                |

**Outstanding business rulings, unchanged in number and now better evidenced:**

1. Significance ratification for the 304 mutating actions — the Class A/B boundary itself, now
   costed by §7.
2. The Redis cohort ruling (§3) — 11 sites, 10 names, subsuming the B8 `OTP_VERIFIED` question.
3. Whether the 5 mixed actions are split, renamed, or classified per site (§2).

**Two new items Pass 2A surfaced for a decision:**

4. `password.service.ts:224` — a catch-all handler that no class fits (§2).
5. Whether the ordering defect (§5) is fixed now, independently of any classification, since it
   is wrong under either.
