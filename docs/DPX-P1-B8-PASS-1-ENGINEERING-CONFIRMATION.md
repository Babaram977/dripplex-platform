# DPX-P1-B8 — Pass 1: Engineering Confirmation of the Ambiguous Audit Actions

**Status: READ-ONLY EVIDENCE. No code, trigger, migration or caller change. B8 remains HOLD 🔴.**

Fifth in the series, after the inventory (`246bdc0`), decision matrix (`53117f0`), policy
proposal (`2881d53`) and action matrix (`8e9bf9f`). Measured against the working tree at
`b8-sync` @ `002feaf`; every line reference below is to `apps/backend/src/`.

Pass 1 was scoped to four things and does all four:

1. Read the enclosing method for all 28 AMB-2 / AMB-3 / AMB-5 actions.
2. Trace one level into collaborators where the mutation is delegated.
3. Resolve whether a committed mutation actually occurs.
4. Investigate the 14-site "mixed action" and determine whether it is two semantic events
   needing separate names.

Pass 2 — business ratification of the 137 AMB-4 actions — is **not** authorized and is not
attempted here.

---

## Headline findings

1. **23 of the 28 have a real, committed Postgres mutation** delegated one level down. The
   static scan's "mutation = no" was the predicted collaborator false-negative, and it fired on
   the large majority. These move to **Class A candidates**.
2. **4 are confirmed Class B** — genuinely nothing committed.
3. **1 cannot be classified under the policy at all**: `AUTH_AUDIT_ACTIONS.OTP_VERIFIED` mutates
   **Redis only**. It has no Postgres transaction to be atomic with, so neither class fits.
4. **The 14-site "mixed action" is not a mixed action.** `<unresolved>` was an extraction
   artifact of the matrix's own regex, not a real audit action. **No action needs splitting.**
5. But resolving it exposed a **coverage gap in the matrix**: those 14 sites reach **36 distinct
   audit action constants**, of which **35 appear nowhere in the matrix** — including
   `WALLET_AUDIT_ACTIONS.CREDITED` / `DEBITED` / `HELD` / `HOLD_COMMITTED` / `HOLD_RELEASED` and
   `COMMERCIAL_AUDIT_ACTIONS.BLOCKED` / `UNBLOCKED`. The classified universe is therefore
   **329 distinct actions, not 295**.
6. Three **ordering defects** were found that no static pass could see, where the audit record is
   written _before_ the mutation it claims to attest.

---

## Part A — the 28 actions, resolved

Method: read the enclosing method; where it called a collaborator, read that collaborator and
confirm the Prisma write. Every "Class A candidate" row below was confirmed to a concrete
`prisma.<model>.create/update/updateMany` — no inference from naming.

### A.1 — Class A candidates: committed mutation confirmed (23 actions)

**From AMB-2 (legal/regulatory) — 10 of 12**

| Action                                 | Site                                              | Committed mutation, confirmed                                                                                                                              |
| -------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_AUDIT_ACTIONS.EMAIL_VERIFIED`    | `auth/services/email-verification.service.ts:161` | `verificationRepository.markConsumed` → `identityVerification.update`; `usersService.markEmailVerified` → `user.update`; `activateIfVerificationsComplete` |
| `AUTH_AUDIT_ACTIONS.PHONE_VERIFIED`    | `auth/services/phone-verification.service.ts:174` | `markConsumed` → `identityVerification.update`; `markPhoneVerified` → `user.update`; `activateIfVerificationsComplete`                                     |
| `MERCHANT_AUDIT_ACTIONS.KYC_SUBMITTED` | `merchants/merchants.service.ts:475`              | `merchantsRepository.createKyc` → `merchantKyc.create`                                                                                                     |
| `MERCHANT_AUDIT_ACTIONS.KYC_VERIFIED`  | `merchants/merchants.service.ts:664`              | `merchantsRepository.verifyKyc` → `merchantKyc.update`                                                                                                     |
| `MERCHANT_AUDIT_ACTIONS.KYC_REJECTED`  | `merchants/merchants.service.ts:703`              | `merchantsRepository.rejectKyc` → `merchantKyc.update`                                                                                                     |
| `MERCHANT_AUDIT_ACTIONS.APPROVED`      | `merchants/merchants.service.ts:847`              | `merchantsRepository.updateMerchantLifecycle`                                                                                                              |
| `MERCHANT_AUDIT_ACTIONS.REJECTED`      | `merchants/merchants.service.ts:987`              | `merchantsRepository.updateMerchantLifecycle`                                                                                                              |
| `MERCHANT_AUDIT_ACTIONS.SUSPENDED`     | `merchants/merchants.service.ts:1033`             | `merchantsRepository.updateMerchantLifecycle`                                                                                                              |
| `ORDER_AUDIT_ACTIONS.REJECTED`         | `orders/merchant-orders.service.ts:124`           | `refundIfPaid(...)` then `ordersRepository.transition` → `order.update`                                                                                    |
| `PAYMENT_AUDIT_ACTIONS.VERIFIED`       | `payments/payment.service.ts:375` and `:676`      | `:375` `ordersRepository.transition`; `:676` `paymentRepository.markSuccess` → `paymentTransaction.updateMany`, then `finalizeOrderConfirmation`           |

**From AMB-3 (security-state) — 9 of 12**

| Action                                         | Site(s)                                                                              | Committed mutation, confirmed                                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `AUTH_AUDIT_ACTIONS.PASSWORD_CHANGED`          | `auth/services/password.service.ts:212`                                              | `usersService.updatePassword` → `user.update`; `authSessionRepository.revokeAllForUser` → `authSession.updateMany` |
| `AUTH_AUDIT_ACTIONS.PASSWORD_RESET_SUCCESS`    | `auth/services/password.service.ts:142`                                              | same pair                                                                                                          |
| `AUTH_AUDIT_ACTIONS.SESSIONS_REVOKED_PASSWORD` | `password.service.ts:130`, `:200`                                                    | `revokeAllForUser` → `authSession.updateMany`                                                                      |
| `AUTH_AUDIT_ACTIONS.SESSIONS_REVOKED_ALL`      | `session-management.service.ts:92`                                                   | `revokeAllExcept` → `authSession.updateMany`                                                                       |
| `AUTH_AUDIT_ACTIONS.SESSION_CREATED`           | `session.service.ts:43`                                                              | `authSessionRepository.create`                                                                                     |
| `AUTH_AUDIT_ACTIONS.SESSION_REVOKED`           | `logout.service.ts:29`, `session-management.service.ts:74`, `refresh.service.ts:138` | `revokeSession` → `authSession.update` at all three                                                                |
| `AUTH_AUDIT_ACTIONS.SESSION_ACTIVITY`          | `session-activity.service.ts:42`                                                     | `updateLastActive` → `authSession.update` — **see the caveat below**                                               |
| `MERCHANT_AUDIT_ACTIONS.BANK_CREATED`          | `merchants/merchants.service.ts:534`                                                 | `createBankAccount` → `prisma.$transaction`                                                                        |
| `MERCHANT_AUDIT_ACTIONS.BANK_UPDATED`          | `merchants/merchants.service.ts:566`                                                 | `setDefaultBankAccount` → `prisma.$transaction`                                                                    |

**From AMB-5 (financial) — 4 of 4**

| Action                                      | Site                                           | Committed mutation, confirmed                                                    |
| ------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------- |
| `COMMERCIAL_AUDIT_ACTIONS.PAYMENT_RECORDED` | `commercial/commission-account.service.ts:230` | `prisma.$transaction(applyMutation)` — **audit sits outside the transaction**    |
| `ORDER_AUDIT_ACTIONS.PAYMENT_CONFIRMED`     | `orders/merchant-orders.service.ts:228`        | `ordersRepository.transition` → `order.update`                                   |
| `PAYMENT_AUDIT_ACTIONS.REFUNDED`            | `payments/payment.service.ts:943`              | `walletService.refund(...)` then `ordersRepository.transition`                   |
| `WALLET_AUDIT_ACTIONS.TRANSFERRED`          | `wallet/wallet.service.ts:254`                 | `prisma.$transaction(applyMutation ×2)` — **audit sits outside the transaction** |

**Caveat on `SESSION_ACTIVITY`.** The mutation is real, so it passes the Class A test
mechanically. But the write is a throttled `lastActiveAt` heartbeat (Redis `setNx` gate, default
60s) — telemetry, not a security decision. It is the one row in this table where the mutation
test and the business weight point in opposite directions, and it is a founder call, not an
engineering one. Placing it in Class A means a failed audit write aborts a session-activity ping.

### A.2 — Class B confirmed: no committed mutation (4 actions)

| Action                                      | Site                               | Why                                                                                                                                                            |
| ------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_AUDIT_ACTIONS.SESSION_LIST`           | `session-management.service.ts:40` | `findActiveSessions` is a read. The method writes nothing.                                                                                                     |
| `PAYMENT_AUDIT_ACTIONS.WEBHOOK_REJECTED`    | `payments/payment.service.ts:515`  | `adapter.handleWebhook` is pure — signature/config/reference checks only, no DB touch (verified in `providers/paystack.provider.ts:113`). Records then throws. |
| `AUTH_AUDIT_ACTIONS.PASSWORD_FORGOT`        | `password.service.ts:59`           | Recorded at the top of `forgotPassword`, **before** any write. See A.4.                                                                                        |
| `AUTH_AUDIT_ACTIONS.PASSWORD_RESET_STARTED` | `password.service.ts:102`          | Recorded at the top of `resetPassword`, **before** any write. See A.4.                                                                                         |

### A.3 — Neither class fits (1 action)

`AUTH_AUDIT_ACTIONS.OTP_VERIFIED` — `auth/services/otp.service.ts:136`.

The method's only mutations are `redis.del(otpKey)`, `redis.del(attemptsKey)` and
`redis.del(lockoutKey)`. **There is no Postgres write anywhere in it.** The state change is real
and security-relevant — the OTP is burned, and burning it is what makes replay impossible — but
it lives in Redis.

The policy's Class A guarantee is "the audit write is atomic with the business mutation." That
guarantee cannot be constructed here: Redis is not transactional with Postgres, and the standing
prohibition is explicit that **Redis is never the audit authority**. Classifying it Class A would
create a guarantee the runtime cannot honour. Classifying it Class B silently drops a security
event to best-effort.

**Recorded as a gap for founder decision, not resolved here.** The three shapes available are:
(a) accept Class B with the reason stated on the record; (b) give OTP consumption a Postgres
row so there is something to be atomic with — a schema change, out of B8 scope; (c) a third class
for Redis-authoritative events. No implementation is proposed under §3 of the playbook.

### A.4 — Ordering defects: the record precedes the mutation

These are correctness observations, not classification. No static pass could see them, and each
one means an authoritative record would today attest to something that has not yet happened.

1. **`PASSWORD_FORGOT`** (`password.service.ts:59`). The record is written first, then
   `passwordResetTokenRepository.invalidateActiveForUser` and `.create` run. The record is
   emitted unconditionally, including for an email that matches no account — so it documents
   _intake_, not the token issuance. Correct as Class B on today's semantics; if it were ever
   promoted, the record would have to move after the writes.
2. **`PASSWORD_RESET_STARTED`** (`password.service.ts:102`). Same shape: recorded before
   `updatePassword` / `revokeAllForUser`. The committed outcome is already covered separately by
   `PASSWORD_RESET_SUCCESS` (A.1).
3. **`PROFILE_EMAIL_CHANGED` / `PROFILE_PHONE_CHANGED`** (`auth/services/profile.service.ts:279`).
   This one is a genuine defect. `confirmPendingChange` records the _success_ action, then
   returns; the caller (`confirmEmailChange:215`, `confirmPhoneChange:158`) only then runs
   `usersService.updateEmail` / `updatePhone`. **The audit says the address changed before the
   row is written.** If that update throws, the audit log carries a change that never happened.
   Flagged for founder confirmation; no fix proposed or applied.

---

## Part B — the 14-site "mixed action"

### B.1 — It is an extraction artifact, not an audit action

The matrix's AMB-1 row is a single pseudo-action, `<unresolved>`, covering 14 sites across nine
domains and marked "mutation = mixed". That row does not correspond to any audit action. It is
what the matrix's regex produced for the 14 `auditService.record(...)` sites whose **first
argument is not a string literal or a `*_AUDIT_ACTIONS.*` constant** — so the constant could not
be read off the call site and 14 unrelated sites collapsed into one row.

Re-extracted independently: exactly **14 sites**, matching the matrix's count.

```
auth/services/profile.service.ts:236, :249, :264, :279   -> actions.failed / actions.succeeded
bookings/bookings.service.ts:703, :1072                  -> auditAction
commercial/commission-account.service.ts:542             -> ternary
delivery/delivery.service.ts:1053                        -> action
drivers/inspections/inspections.service.ts:277           -> ternary
fleets/fleets.service.ts:189                             -> ternary
fraud/fraud.service.ts:386                               -> action
rides/ride-trip.service.ts:267                           -> action
wallet/wallet.service.ts:535, :717                       -> ternary
```

**Direct answer to the question asked: no. It does not represent two semantic events, and no
action needs splitting or correcting.** Every one of the 14 already resolves to distinct,
separately-named constants. There is nothing to split — the names exist.

### B.2 — The 14 are three different shapes, and only one is runtime-selected

| Shape                      | Sites | What it is                                                                                                               |
| -------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------ |
| **Helper indirection**     | 5     | A private audit helper takes `action: string` as a parameter. Every caller passes a constant. Nothing varies at runtime. |
| **Action-set indirection** | 4     | `confirmPendingChange` takes an `{requested, failed, succeeded}` literal. The caller (email vs phone) fixes which.       |
| **Genuine runtime branch** | 5     | A ternary on runtime state selects between two or three constants at the record call.                                    |

Helper indirection, callers verified — all constants:

- `bookings.unwind` (site `:703`) ← `BOOKING_AUDIT_ACTIONS.REJECTED` (`:426`), `EXPIRED` (`:462`)
- `bookings.transitionBooking` (site `:1072`) ← `CHECKED_IN` (`:984`), `CHECKED_OUT` (`:1002`), `NO_SHOW` (`:1037`)
- `delivery.auditLifecycle` (site `:1053`) ← 12 callers, 11 distinct `DELIVERY_AUDIT_ACTIONS` constants
- `fraud.reviewWithAudit` (site `:386`) ← `SIGNAL_CLEARED` (`:243`), `SIGNAL_CONFIRMED` (`:257`)
- `ride-trip.audit` (site `:267`) ← `ARRIVED` (`:74`), `STARTED` (`:95`), `COMPLETED` (`:128`)

The five genuine runtime branches:

| Site                                             | Selects between                                                  |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| `drivers/inspections/inspections.service.ts:277` | `DRIVER_AUDIT_ACTIONS.INSPECTION_PASSED` / `INSPECTION_FAILED`   |
| `fleets/fleets.service.ts:189`                   | `FLEET_AUDIT_ACTIONS.REGISTERED` / `CREATED`                     |
| `wallet/wallet.service.ts:535`                   | `WALLET_AUDIT_ACTIONS.CREDITED` / `DEBITED`                      |
| `wallet/wallet.service.ts:717`                   | `WALLET_AUDIT_ACTIONS.HELD` / `HOLD_COMMITTED` / `HOLD_RELEASED` |
| `commercial/commission-account.service.ts:542`   | `COMMERCIAL_AUDIT_ACTIONS.BLOCKED` / `UNBLOCKED`                 |

All five sit **after** a committed mutation, and three of the five sit immediately after a
`prisma.$transaction(...)` block with the audit call outside it (`wallet:535`, `wallet:717`,
`commission-account:542`, and the same shape at `wallet:254` and `commission-account:230` from
Part A). If any of those constants is ratified Class A, that is the **cheapest possible
migration**: the transaction boundary already exists and the audit write only has to move inside
it. No new transaction has to be introduced.

### B.3 — The coverage gap this exposed

The 14 sites reach **36 distinct audit action constants**. Checked one by one against
`docs/DPX-P1-B8-AUDIT-ACTION-MATRIX.md`: **35 of the 36 appear nowhere in it.** The single
exception is `DELIVERY_AUDIT_ACTIONS.LOCATION_UPDATED`, which is classified only because it has a
_second_, statically-resolvable call site at `delivery/tracking.service.ts:86`.

Among the 35 uncovered are actions the significance heuristic would have marked financial on
sight:

```
WALLET_AUDIT_ACTIONS.CREDITED          WALLET_AUDIT_ACTIONS.DEBITED
WALLET_AUDIT_ACTIONS.HELD              WALLET_AUDIT_ACTIONS.HOLD_COMMITTED
WALLET_AUDIT_ACTIONS.HOLD_RELEASED     COMMERCIAL_AUDIT_ACTIONS.BLOCKED
COMMERCIAL_AUDIT_ACTIONS.UNBLOCKED
```

and the rest: `DRIVER_AUDIT_ACTIONS.INSPECTION_PASSED` / `INSPECTION_FAILED`,
`FLEET_AUDIT_ACTIONS.REGISTERED` / `CREATED`, `AUTH_AUDIT_ACTIONS.PROFILE_{EMAIL,PHONE}_CHANGED`
and `..._CHANGE_FAILED`, `BOOKING_AUDIT_ACTIONS.{REJECTED,EXPIRED,CHECKED_IN,CHECKED_OUT,NO_SHOW}`,
ten further `DELIVERY_AUDIT_ACTIONS.*`, `FRAUD_AUDIT_ACTIONS.{SIGNAL_CLEARED,SIGNAL_CONFIRMED}`,
`RIDE_AUDIT_ACTIONS.{ARRIVED,STARTED,COMPLETED}`.

**Restated denominator.** The matrix's 295 is 294 named actions plus the `<unresolved>`
placeholder. Replacing the placeholder with the 35 previously-uncounted constants gives
**329 distinct audit actions**. The **361 production call sites figure is unchanged** — these 14
sites were always counted; only their actions were invisible.

`WALLET_AUDIT_ACTIONS.CREDITED` and `DEBITED` are the material ones: every wallet credit and
debit on the platform flows through `wallet.service.ts:535`, and neither action reached the
ratification document.

---

## Corrections to the action matrix (`8e9bf9f`)

Recorded here rather than by editing `8e9bf9f`, which the founder accepted as the evidence
baseline. The matrix's data tables are sound; these are the three defects found.

1. **AMB-1 is not an ambiguous action.** It is an unresolved-extraction bucket. Its resolution
   path ("read the call sites… may need splitting into two actions") does not apply — the
   answer is that no split is needed and 35 actions were missing from the count.
2. **The classified universe is 329 distinct actions, not 295.** Sites remain 361.
3. **Two label errors in "What ratification requires"** (the prose section only; the tables are
   correct): item 2 says "Resolve AMB-1 (137 actions)" — 137 is **AMB-4**; item 3 says
   "confirm AMB-2/3/4 (29 actions)" — the inspection groups are **AMB-2 / AMB-3 / AMB-5**, and
   they total **28** actions across 32 sites, which is the set Pass 1 actually resolved.

---

## Where this leaves the ratification

|                                        | Before Pass 1 | After Pass 1                                      |
| -------------------------------------- | ------------- | ------------------------------------------------- |
| Class A (proposed)                     | 62 actions    | 85 actions — 62 + the 23 confirmed here           |
| Class B (proposed)                     | 67 actions    | 71 actions — 67 + the 4 confirmed here            |
| Needs a class that does not exist      | —             | 1 (`OTP_VERIFIED`, Redis-only)                    |
| Ambiguous, awaiting business judgement | 166 actions   | 137 (AMB-4) **+ 35 newly surfaced, unclassified** |
| Distinct actions total                 | 295           | 329                                               |

**Nothing in this document has been applied.** No trigger change, no caller migration, no
migration edit, no production change of any kind. `b8-sync` is unchanged and unpushed; PR #351
and `claude/p1-b8-archive-purge-6o3vb8` are untouched.

**Pass 2 is not authorized and has not been started.** Two items now sit ahead of it and are put
to the founder rather than decided here:

1. The 35 newly surfaced actions need the same Class A/B treatment as AMB-4 before the
   ratification is complete — the wallet credit/debit pair in particular.
2. `OTP_VERIFIED` needs a ruling: accept Class B, add a Postgres row, or define a third class.
