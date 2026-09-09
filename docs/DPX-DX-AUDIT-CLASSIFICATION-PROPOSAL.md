# DPX-DX — Proposed Audit Classification for Ratification (329 actions)

**Status: PROPOSAL FOR FOUNDER RATIFICATION. Read-only — no code, migration, trigger,
transaction-boundary or caller change. No implementation authorization.**

Built entirely from the completed forensic evidence: DX Pass 1 (`89c7aff`) and DX Pass 2A
(`9e5e787`), measured on `main` @ `3b63c28`. Nothing here is a new measurement.

**Every class below is a proposal except the three already ratified**, which are marked and
carried through unchanged.

---

## 1. The proposal in one table

| Proposed                                                            | Actions | Sites   |
| ------------------------------------------------------------------- | ------- | ------- |
| **Class A** — authoritative, audit atomic with the mutation         | **139** | **148** |
| **Class B** — observational, best-effort                            | **185** | **194** |
| **Site-level** — the 5 genuinely mixed actions, classified per site | **5**   | **19**  |
| **Total**                                                           | **329** | **361** |

**Class A splits by significance:** 58 financial · 46 legal/compliance · 33 security-state, plus
the 2 ordering-defect actions counted in the 139.

**Class B splits by basis:** 166 operational (mutation real, weight insufficient) · 10 no mutation
· 6 Redis-only (ratified) · 2 mixed-but-uniformly-B · 1 ratified (`SESSION_ACTIVITY`).

---

## 2. How Class A was proposed, and why not by pattern

The first attempt derived significance from the action name by regular expression. **It was
discarded and none of its output is used here.** It marked `ADDRESS_AUDIT_ACTIONS.DELETED` as
legal/regulatory because the name contains "DELET", and every `AUTH_*` action as security-state
because of the prefix — including `EMAIL_SENT`. It produced 151 Class A actions, and the number
was meaningless.

The proposal below is **hand-curated action by action** against a single test:

> **Would the loss of this record leave DrippleX unable to answer a question it is obliged to
> answer — about money that moved, a compliance decision taken, or a change to who can access
> what?**

Three admitted categories:

- **Financial** — value moved, an obligation was created or discharged, or the terms on which
  either happens were changed.
- **Legal/compliance** — a regulated identity decision, an admission or exclusion from the
  platform, a safety incident, or a consent.
- **Security-state** — a change to credentials, sessions, payout destinations, or the fraud
  posture.

Everything else is **operational**: the mutation is real, but the record is a convenience, not an
obligation. That is where 166 of the 185 Class B actions sit — and it is the single largest
judgement in this document. **If you disagree with the boundary anywhere, it is most likely to be
there.**

Deliberate exclusions worth surfacing, because each is arguable:

| Excluded from A                                               | Reasoning                                                 | Counter-argument                                                                  |
| ------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Order lifecycle (`CREATED`, `ACCEPTED`, `READY`, `CANCELLED`) | the money events are audited separately and _are_ Class A | `CANCELLED` can trigger a refund; the refund is recorded, the cancellation is not |
| Ride lifecycle (`REQUESTED`, `STARTED`, `COMPLETED`)          | fare and payment events carry the money                   | `COMPLETED` is what makes the fare due                                            |
| `PAYMENT.INVENTORY_DEDUCTED`                                  | inventory, not money                                      | stock is value                                                                    |
| `REFRESH_SUCCESS`                                             | token rotation, very high volume                          | it is an authentication event                                                     |
| Product, CMS, promotion and campaign administration           | configuration, not transactions                           | a changed price affects every subsequent order                                    |

---

## 3. The three ratified decisions, carried through

| Decision                                                 | Effect on this proposal                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`SESSION_ACTIVITY` → Class B**                         | Applied. Its Postgres mutation (`authSessionRepository.updateLastActive`) is confirmed in both forensic universes; it is classified B as telemetry, not for want of a mutation. One decision, not two.                                                                                                                      |
| **Redis cohort — no blanket migration**                  | Applied. The 6 exclusively-Redis actions are Class B. No Postgres authority is proposed for credential/identity consumption or for throttle/lockout state. `PASSWORD_FORGOT` is included here, with the note that `PasswordResetToken` already gives it a durable boundary later in its own method should that ever change. |
| **`password.service.ts:224` → split during remediation** | Applied. It is not classified. It appears in §4 as one site of `PASSWORD_CHANGE_FAILED` with a proposed split, and no class is assigned to it.                                                                                                                                                                              |

---

## 4. The five mixed actions — proposed site-level classification

19 sites. Classifying by action name would be wrong for all five.

### `AUTH_AUDIT_ACTIONS.VERIFICATION_EXPIRED` — 2 sites

| Site                               | Preceding mutation                             | Proposed                                           |
| ---------------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| `email-verification.service.ts:98` | none                                           | **B**                                              |
| `phone-verification.service.ts:93` | `markConsumed` → `identityVerification.update` | **A** (legal — an identity challenge was consumed) |

_Also proposed:_ rename. One name meaning "expired, nothing happened" in one flow and "expired,
challenge burned" in another is a reporting hazard independent of class.

### `AUTH_AUDIT_ACTIONS.PHONE_VERIFICATION_FAILED` — 6 sites

| Site                      | Preceding                          | Proposed                                |
| ------------------------- | ---------------------------------- | --------------------------------------- |
| `:64` unknown phone       | none                               | **B**                                   |
| `:83` no active challenge | none                               | **B**                                   |
| `:102` OTP expired        | `markConsumed` (Postgres)          | **A**                                   |
| `:116` attempts exceeded  | `redis.set(lockKey)` only          | **B (Redis)** — per the ratified cohort |
| `:138` invalid OTP        | `incrementAttemptCount` (Postgres) | **A**                                   |
| `:152` OTP reused         | `incrementAttemptCount` (Postgres) | **A**                                   |

### `AUTH_AUDIT_ACTIONS.EMAIL_VERIFICATION_FAILED` — 6 sites

`:68`, `:78`, `:85`, `:110`, `:123` → **B**. `:141` (after `incrementAttemptCount`) → **A**.

### `AUTH_AUDIT_ACTIONS.OTP_FAILED` — 2 sites

`otp.service.ts:116` → **B**. `otp.service.ts:214` (after `redis.incr` + `expire`) → **B (Redis)**.

### `AUTH_AUDIT_ACTIONS.PASSWORD_CHANGE_FAILED` — 3 sites

| Site                          | Preceding         | Proposed                 |
| ----------------------------- | ----------------- | ------------------------ |
| `:176` wrong current password | none              | **B**                    |
| `:185` identical password     | none              | **B**                    |
| `:224` outer `catch`          | **indeterminate** | **unclassified — split** |

**Proposed split for `:224`**, per the ratified direction. The handler is reachable from before
_and_ after `updatePassword` and `revokeAllForUser` commit, so one name is asserting two different
facts. The split that follows the evidence is by position relative to the commit — one action for
a failure with nothing written, one for a failure after the password already changed. **The second
is the operationally dangerous case**: the user's password has changed and the request reported
failure. No name is proposed here; naming is remediation.

**Site-level totals:** 8 Class A · 9 Class B · 1 Redis · 1 unclassified.

---

## 5. The ordering defect — classified, and separately tracked

`AUTH_AUDIT_ACTIONS.PROFILE_EMAIL_CHANGED` and `PROFILE_PHONE_CHANGED` are proposed **Class A**
(security-state — stable identity changed). They are marked ⚠ in the tables because their class is
not their only problem.

Both are recorded at `profile.service.ts:279`, inside `confirmPendingChange`, **before** the caller
performs the `user.update` they assert (`:158` phone, `:215` email). The Redis pending record is
deleted at `:276`, so a failed update leaves a success in the log, the old address in the row, and
no retry path.

**Per your ratification, this is tracked as an independent correctness remediation.** It is wrong
under Class A and under Class B alike, and fixing it does not depend on this document being
ratified.

---

## 6. Remediation cost of the proposal

The Class A proposal covers **148 call sites**. Using the Pass 2A cost bands:

| Band                        | Sites  | What it takes                                                              |
| --------------------------- | ------ | -------------------------------------------------------------------------- |
| **Boundary already exists** | **14** | move the record inside the existing `$transaction`                         |
| **Local**                   | **84** | open a transaction in the same method                                      |
| **Repository-owned**        | **27** | add an optional `tx` parameter to a repository method                      |
| **Structural**              | **14** | a transaction context must cross a service boundary                        |
| **Needs investigation**     | **8**  | characterize before estimating                                             |
| **N/A**                     | 1      | `profile.service.ts:279` — the ordering defect, fixed by moving the record |

**Only 14 of 148 are structural.** 125 of 148 — 84% — never cross a service boundary.

This is the number that makes the proposal affordable, and it is much better than the raw
286-site figure suggests, because the Class A proposal is concentrated in domains that already
transact. Of the 32 sites with an existing boundary, 14 land in Class A — including the whole
wallet ledger cluster.

The structural core remains the payments/wallet/checkout/cart group identified in Pass 2A §7,
principally `PAYMENT.REFUNDED` and `PAYMENT.INITIALIZED` delegating money movement to
`WalletService`. **That design decision is still not made here.**

---

## 7. Full proposed classification — all 329 actions

**A** = proposed Class A · **A ⚠** = Class A with the ordering defect · B = proposed Class B ·
**site-level** = §4.

**`DRIVER_AUDIT_ACTIONS`** — 40 actions, 20 proposed Class A

| Action                            | Sites | Proposed | Basis            |
| --------------------------------- | ----- | -------- | ---------------- |
| `AGREEMENT_ACCEPTED`              | 1     | **A**    | legal/compliance |
| `APPROVED`                        | 1     | **A**    | legal/compliance |
| `EMERGENCY_CONTACT_UPDATED`       | 1     | B        | operational      |
| `IDENTITY_VERIFICATION_FAILED`    | 1     | **A**    | legal/compliance |
| `IDENTITY_VERIFICATION_LOCKED`    | 1     | **A**    | security-state   |
| `IDENTITY_VERIFICATION_PASSED`    | 2     | **A**    | legal/compliance |
| `IDENTITY_VERIFICATION_REQUESTED` | 1     | **A**    | legal/compliance |
| `IDENTITY_VERIFICATION_UNLOCKED`  | 1     | **A**    | security-state   |
| `INCIDENT_REPORT_SUBMITTED`       | 1     | **A**    | legal/compliance |
| `INCIDENT_REPORT_UPDATED`         | 1     | B        | operational      |
| `INSPECTION_CANCELLED`            | 1     | B        | operational      |
| `INSPECTION_CENTRE_CREATED`       | 1     | B        | operational      |
| `INSPECTION_CENTRE_UPDATED`       | 1     | B        | operational      |
| `INSPECTION_CHECKLIST_RECORDED`   | 1     | B        | operational      |
| `INSPECTION_FAILED`               | 1     | **A**    | legal/compliance |
| `INSPECTION_PASSED`               | 1     | **A**    | legal/compliance |
| `INSPECTION_SCHEDULED`            | 1     | B        | operational      |
| `KYC_REJECTED`                    | 1     | **A**    | legal/compliance |
| `KYC_SUBMITTED`                   | 1     | **A**    | legal/compliance |
| `KYC_VERIFIED`                    | 1     | **A**    | legal/compliance |
| `ONBOARDING_SUBMITTED`            | 1     | B        | operational      |
| `PLANNED_AVAILABILITY_DELETED`    | 1     | B        | operational      |
| `PLANNED_AVAILABILITY_SET`        | 1     | B        | operational      |
| `PROFILE_UPDATED`                 | 1     | B        | operational      |
| `REACTIVATED`                     | 1     | **A**    | legal/compliance |
| `REJECTED`                        | 1     | **A**    | legal/compliance |
| `SECURITY_SETTINGS_UPDATED`       | 1     | **A**    | security-state   |
| `SHIFT_BREAK_ENDED`               | 1     | B        | operational      |
| `SHIFT_BREAK_STARTED`             | 1     | B        | operational      |
| `SHIFT_ENDED`                     | 1     | B        | operational      |
| `SHIFT_FORCE_ENDED`               | 1     | B        | operational      |
| `SHIFT_STARTED`                   | 1     | B        | operational      |
| `SOS_ALERT_TRIGGERED`             | 2     | **A**    | legal/compliance |
| `SOS_ALERT_UPDATED`               | 1     | B        | operational      |
| `SUPPORT_TICKET_SUBMITTED`        | 1     | B        | operational      |
| `SUPPORT_TICKET_UPDATED`          | 1     | B        | operational      |
| `SUSPENDED`                       | 1     | **A**    | legal/compliance |
| `VEHICLE_APPROVED`                | 1     | **A**    | legal/compliance |
| `VEHICLE_REJECTED`                | 1     | **A**    | legal/compliance |
| `VEHICLE_SUBMITTED`               | 2     | B        | operational      |

**`AUTH_AUDIT_ACTIONS`** — 44 actions, 18 proposed Class A

| Action                           | Sites | Proposed       | Basis            |
| -------------------------------- | ----- | -------------- | ---------------- |
| `EMAIL_SENT`                     | 1     | B              | operational      |
| `EMAIL_VERIFICATION_FAILED`      | 6     | **site-level** | mixed — see §4   |
| `EMAIL_VERIFIED`                 | 1     | **A**          | legal/compliance |
| `GOOGLE_ACCOUNT_CREATED`         | 1     | **A**          | security-state   |
| `GOOGLE_ACCOUNT_LINKED`          | 1     | **A**          | security-state   |
| `GOOGLE_LOGIN_FAILED`            | 1     | B              | operational      |
| `GOOGLE_LOGIN_STARTED`           | 1     | B              | no mutation      |
| `GOOGLE_LOGIN_SUCCESS`           | 1     | **A**          | security-state   |
| `LOGIN_FAILED`                   | 1     | B (Redis)      | Redis-only       |
| `LOGIN_STARTED`                  | 1     | B              | no mutation      |
| `LOGIN_SUCCESS`                  | 1     | **A**          | security-state   |
| `LOGOUT`                         | 1     | **A**          | security-state   |
| `LOGOUT_ALL`                     | 1     | **A**          | security-state   |
| `OTP_FAILED`                     | 2     | **site-level** | mixed — see §4   |
| `OTP_SENT`                       | 1     | B (Redis)      | Redis-only       |
| `OTP_VERIFIED`                   | 1     | B (Redis)      | Redis-only       |
| `PASSWORD_CHANGED`               | 1     | **A**          | security-state   |
| `PASSWORD_CHANGE_FAILED`         | 3     | **site-level** | mixed — see §4   |
| `PASSWORD_FORGOT`                | 1     | B (Redis)      | Redis-only       |
| `PASSWORD_RESET_FAILED`          | 1     | B              | no mutation      |
| `PASSWORD_RESET_STARTED`         | 1     | B              | no mutation      |
| `PASSWORD_RESET_SUCCESS`         | 1     | **A**          | security-state   |
| `PHONE_OTP_SENT`                 | 1     | B              | operational      |
| `PHONE_VERIFICATION_FAILED`      | 6     | **site-level** | mixed — see §4   |
| `PHONE_VERIFIED`                 | 1     | **A**          | legal/compliance |
| `PROFILE_EMAIL_CHANGED`          | 1     | **A** ⚠        | security-state   |
| `PROFILE_EMAIL_CHANGE_FAILED`    | 3     | B              | operational      |
| `PROFILE_EMAIL_CHANGE_REQUESTED` | 1     | B (Redis)      | Redis-only       |
| `PROFILE_PHONE_CHANGED`          | 1     | **A** ⚠        | security-state   |
| `PROFILE_PHONE_CHANGE_FAILED`    | 3     | B              | operational      |
| `PROFILE_PHONE_CHANGE_REQUESTED` | 1     | B (Redis)      | Redis-only       |
| `PROFILE_UPDATED`                | 1     | B              | operational      |
| `REFRESH_FAILED`                 | 7     | B              | no mutation      |
| `REFRESH_REUSED`                 | 1     | **A**          | security-state   |
| `REFRESH_STARTED`                | 1     | B              | no mutation      |
| `REFRESH_SUCCESS`                | 1     | B              | operational      |
| `REGISTRATION_COMPLETED`         | 2     | **A**          | security-state   |
| `SESSIONS_REVOKED_ALL`           | 1     | **A**          | security-state   |
| `SESSIONS_REVOKED_PASSWORD`      | 2     | **A**          | security-state   |
| `SESSION_ACTIVITY`               | 1     | B (ratified)   | operational      |
| `SESSION_CREATED`                | 1     | **A**          | security-state   |
| `SESSION_LIST`                   | 1     | B              | no mutation      |
| `SESSION_REVOKED`                | 3     | **A**          | security-state   |
| `VERIFICATION_EXPIRED`           | 2     | **site-level** | mixed — see §4   |

**`WALLET_AUDIT_ACTIONS`** — 18 actions, 15 proposed Class A

| Action                 | Sites | Proposed | Basis          |
| ---------------------- | ----- | -------- | -------------- |
| `BANK_ACCOUNT_ADDED`   | 1     | **A**    | security-state |
| `BANK_ACCOUNT_REMOVED` | 1     | **A**    | security-state |
| `CREDITED`             | 1     | **A**    | financial      |
| `DEBITED`              | 1     | **A**    | financial      |
| `FUNDING_FAILED`       | 1     | B        | operational    |
| `FUNDING_INITIATED`    | 1     | B        | operational    |
| `FUNDING_SUCCEEDED`    | 1     | **A**    | financial      |
| `HELD`                 | 1     | **A**    | financial      |
| `HOLD_COMMITTED`       | 1     | **A**    | financial      |
| `HOLD_RELEASED`        | 1     | **A**    | financial      |
| `LIMITS_UPDATED`       | 1     | **A**    | financial      |
| `PIN_CHANGED`          | 1     | **A**    | security-state |
| `PIN_SET`              | 1     | **A**    | security-state |
| `RECONCILED`           | 1     | **A**    | financial      |
| `TRANSFERRED`          | 1     | **A**    | financial      |
| `WITHDRAWAL_COMPLETED` | 1     | **A**    | financial      |
| `WITHDRAWAL_FAILED`    | 1     | B        | operational    |
| `WITHDRAWAL_REQUESTED` | 1     | **A**    | financial      |

**`MERCHANT_AUDIT_ACTIONS`** — 13 actions, 9 proposed Class A

| Action             | Sites | Proposed | Basis            |
| ------------------ | ----- | -------- | ---------------- |
| `APPROVED`         | 1     | **A**    | legal/compliance |
| `BANK_CREATED`     | 1     | **A**    | security-state   |
| `BANK_UPDATED`     | 1     | **A**    | security-state   |
| `BUSINESS_CREATED` | 1     | B        | operational      |
| `BUSINESS_UPDATED` | 3     | B        | operational      |
| `KYC_REJECTED`     | 1     | **A**    | legal/compliance |
| `KYC_SUBMITTED`    | 1     | **A**    | legal/compliance |
| `KYC_VERIFIED`     | 1     | **A**    | legal/compliance |
| `REACTIVATED`      | 1     | **A**    | legal/compliance |
| `REJECTED`         | 1     | **A**    | legal/compliance |
| `STORE_PAUSED`     | 1     | B        | operational      |
| `STORE_RESUMED`    | 1     | B        | operational      |
| `SUSPENDED`        | 1     | **A**    | legal/compliance |

**`RIDE_AUDIT_ACTIONS`** — 22 actions, 9 proposed Class A

| Action                   | Sites | Proposed | Basis       |
| ------------------------ | ----- | -------- | ----------- |
| `ARRIVED`                | 1     | B        | operational |
| `CANCELLED`              | 3     | B        | operational |
| `CASH_CONFIRMED`         | 1     | **A**    | financial   |
| `COMPLETED`              | 1     | B        | operational |
| `FARE_RATE_UPDATED`      | 1     | **A**    | financial   |
| `NO_DRIVERS_FOUND`       | 1     | B        | operational |
| `OFFERED`                | 1     | B        | operational |
| `OFFER_ACCEPTED`         | 1     | B        | operational |
| `OFFER_DECLINED`         | 1     | B        | operational |
| `OFFER_EXPIRED`          | 1     | B        | operational |
| `PAYMENT_FAILED`         | 1     | **A**    | financial   |
| `PAYMENT_INITIATED`      | 2     | **A**    | financial   |
| `PAYMENT_SUCCEEDED`      | 1     | **A**    | financial   |
| `PROBLEM_REPORTED`       | 1     | B        | operational |
| `PROBLEM_RESOLVED`       | 1     | B        | operational |
| `RATED`                  | 1     | B        | operational |
| `REFUNDED`               | 1     | **A**    | financial   |
| `REQUESTED`              | 1     | B        | operational |
| `STARTED`                | 1     | B        | operational |
| `SURCHARGE_ZONE_CREATED` | 1     | **A**    | financial   |
| `SURCHARGE_ZONE_UPDATED` | 1     | **A**    | financial   |
| `TIP_ADDED`              | 1     | **A**    | financial   |

**`ORDER_AUDIT_ACTIONS`** — 16 actions, 8 proposed Class A

| Action                        | Sites | Proposed | Basis            |
| ----------------------------- | ----- | -------- | ---------------- |
| `ACCEPTED`                    | 1     | B        | operational      |
| `CANCELLED`                   | 2     | B        | operational      |
| `COMMISSION_SETTINGS_UPDATED` | 1     | **A**    | financial        |
| `CREATED`                     | 1     | B        | operational      |
| `DELAYED`                     | 1     | B        | operational      |
| `DISPUTE_RAISED`              | 1     | **A**    | legal/compliance |
| `DISPUTE_RESOLVED`            | 1     | **A**    | legal/compliance |
| `INVENTORY_RELEASED`          | 1     | B        | operational      |
| `INVENTORY_RESERVED`          | 1     | B        | operational      |
| `PAYMENT_CONFIRMED`           | 1     | **A**    | financial        |
| `PAYMENT_PROOF_SUBMITTED`     | 1     | **A**    | legal/compliance |
| `READY`                       | 1     | B        | operational      |
| `REJECTED`                    | 1     | B        | operational      |
| `SETTLEMENT_COMPLETED`        | 2     | **A**    | financial        |
| `SETTLEMENT_FAILED`           | 1     | **A**    | financial        |
| `SETTLEMENT_REVERSED`         | 2     | **A**    | financial        |

**`FLEET_AUDIT_ACTIONS`** — 16 actions, 7 proposed Class A

| Action                    | Sites | Proposed | Basis            |
| ------------------------- | ----- | -------- | ---------------- |
| `APPLICATION_REJECTED`    | 1     | **A**    | legal/compliance |
| `APPROVED`                | 1     | **A**    | legal/compliance |
| `CREATED`                 | 1     | B        | operational      |
| `MEMBER_ADDED`            | 1     | B        | operational      |
| `MEMBER_DEACTIVATED`      | 1     | B        | operational      |
| `MEMBER_REACTIVATED`      | 1     | B        | operational      |
| `MEMBER_REMOVED`          | 1     | B        | operational      |
| `MEMBER_REQUESTED`        | 1     | B        | operational      |
| `MEMBER_REQUEST_APPROVED` | 1     | B        | operational      |
| `MEMBER_REQUEST_REJECTED` | 1     | B        | operational      |
| `PERIOD_SETTLED`          | 1     | **A**    | financial        |
| `RATE_NEGOTIATED`         | 1     | **A**    | financial        |
| `REGISTERED`              | 1     | B        | operational      |
| `REINSTATED`              | 1     | **A**    | legal/compliance |
| `SUSPENDED`               | 1     | **A**    | legal/compliance |
| `TIERS_UPDATED`           | 1     | **A**    | financial        |

**`FRAUD_AUDIT_ACTIONS`** — 7 actions, 7 proposed Class A

| Action               | Sites | Proposed | Basis          |
| -------------------- | ----- | -------- | -------------- |
| `LIST_ENTRY_CREATED` | 1     | **A**    | security-state |
| `LIST_ENTRY_DELETED` | 1     | **A**    | security-state |
| `LIST_ENTRY_UPDATED` | 1     | **A**    | security-state |
| `SIGNAL_CLEARED`     | 1     | **A**    | security-state |
| `SIGNAL_CONFIRMED`   | 1     | **A**    | security-state |
| `SIGNAL_REVIEWED`    | 1     | **A**    | security-state |
| `THRESHOLD_UPDATED`  | 1     | **A**    | security-state |

**`RIDER_AUDIT_ACTIONS`** — 8 actions, 7 proposed Class A

| Action            | Sites | Proposed | Basis            |
| ----------------- | ----- | -------- | ---------------- |
| `APPROVED`        | 1     | **A**    | legal/compliance |
| `KYC_REJECTED`    | 1     | **A**    | legal/compliance |
| `KYC_SUBMITTED`   | 1     | **A**    | legal/compliance |
| `KYC_VERIFIED`    | 1     | **A**    | legal/compliance |
| `PROFILE_UPDATED` | 1     | B        | operational      |
| `REACTIVATED`     | 1     | **A**    | legal/compliance |
| `REJECTED`        | 1     | **A**    | legal/compliance |
| `SUSPENDED`       | 1     | **A**    | legal/compliance |

**`COMMERCIAL_AUDIT_ACTIONS`** — 6 actions, 6 proposed Class A

| Action                       | Sites | Proposed | Basis     |
| ---------------------------- | ----- | -------- | --------- |
| `BLOCKED`                    | 1     | **A**    | financial |
| `COMMISSION_SETTING_UPDATED` | 1     | **A**    | financial |
| `CREDIT_LIMIT_NEGOTIATED`    | 1     | **A**    | financial |
| `CREDIT_SETTING_UPDATED`     | 1     | **A**    | financial |
| `PAYMENT_RECORDED`           | 1     | **A**    | financial |
| `UNBLOCKED`                  | 1     | **A**    | financial |

**`DRIVER_CAMPAIGN_AUDIT_ACTIONS`** — 11 actions, 5 proposed Class A

| Action                 | Sites | Proposed | Basis          |
| ---------------------- | ----- | -------- | -------------- |
| `CAMPAIGN_CREATED`     | 1     | B        | operational    |
| `CAMPAIGN_PAUSED`      | 1     | B        | operational    |
| `CAMPAIGN_RESUMED`     | 1     | B        | operational    |
| `CAMPAIGN_UPDATED`     | 1     | B        | operational    |
| `CODE_GENERATED`       | 1     | B        | operational    |
| `FRAUD_CHECK_REVIEWED` | 1     | **A**    | security-state |
| `PASSENGER_QUALIFIED`  | 1     | **A**    | financial      |
| `PASSENGER_REGISTERED` | 1     | B        | operational    |
| `REWARD_APPROVED`      | 1     | **A**    | financial      |
| `REWARD_PAID`          | 1     | **A**    | financial      |
| `REWARD_REJECTED`      | 1     | **A**    | financial      |

**`KYC_AUDIT_ACTIONS`** — 5 actions, 5 proposed Class A

| Action                                | Sites | Proposed | Basis            |
| ------------------------------------- | ----- | -------- | ---------------- |
| `CUSTOMER_KYC_REJECTED`               | 1     | **A**    | legal/compliance |
| `CUSTOMER_KYC_RESUBMISSION_REQUESTED` | 1     | **A**    | legal/compliance |
| `CUSTOMER_KYC_STARTED`                | 1     | **A**    | legal/compliance |
| `CUSTOMER_KYC_SUBMITTED`              | 1     | **A**    | legal/compliance |
| `CUSTOMER_KYC_VERIFIED`               | 1     | **A**    | legal/compliance |

**`UTILITIES_AUDIT_ACTIONS`** — 5 actions, 5 proposed Class A

| Action               | Sites | Proposed | Basis     |
| -------------------- | ----- | -------- | --------- |
| `PURCHASE_FAILED`    | 1     | **A**    | financial |
| `PURCHASE_INITIATED` | 2     | **A**    | financial |
| `PURCHASE_RESOLVED`  | 1     | **A**    | financial |
| `PURCHASE_REVERSED`  | 1     | **A**    | financial |
| `PURCHASE_SUCCEEDED` | 1     | **A**    | financial |

**`BOOKING_AUDIT_ACTIONS`** — 12 actions, 4 proposed Class A

| Action              | Sites | Proposed | Basis       |
| ------------------- | ----- | -------- | ----------- |
| `ACCEPTED`          | 1     | B        | operational |
| `AVAILABILITY_SET`  | 1     | B        | operational |
| `CHECKED_IN`        | 1     | B        | operational |
| `CHECKED_OUT`       | 1     | B        | operational |
| `CREATED`           | 1     | B        | operational |
| `EXPIRED`           | 1     | **A**    | financial   |
| `NO_SHOW`           | 1     | B        | operational |
| `PAID`              | 1     | **A**    | financial   |
| `REJECTED`          | 1     | **A**    | financial   |
| `ROOM_TYPE_CREATED` | 1     | B        | operational |
| `ROOM_TYPE_UPDATED` | 1     | B        | operational |
| `SETTLED`           | 1     | **A**    | financial   |

**`PAYMENT_AUDIT_ACTIONS`** — 7 actions, 4 proposed Class A

| Action               | Sites | Proposed | Basis       |
| -------------------- | ----- | -------- | ----------- |
| `FAILED`             | 3     | **A**    | financial   |
| `INITIALIZED`        | 4     | **A**    | financial   |
| `INVENTORY_DEDUCTED` | 1     | B        | operational |
| `REFUNDED`           | 1     | **A**    | financial   |
| `VERIFIED`           | 2     | **A**    | financial   |
| `WEBHOOK_RECEIVED`   | 1     | B        | no mutation |
| `WEBHOOK_REJECTED`   | 1     | B        | no mutation |

**`LOYALTY_AUDIT_ACTIONS`** — 6 actions, 3 proposed Class A

| Action                | Sites | Proposed | Basis       |
| --------------------- | ----- | -------- | ----------- |
| `ACHIEVEMENT_CREATED` | 1     | B        | operational |
| `ACHIEVEMENT_DELETED` | 1     | B        | operational |
| `ACHIEVEMENT_UPDATED` | 1     | B        | operational |
| `POINTS_AWARDED`      | 1     | **A**    | financial   |
| `POINTS_EXPIRED`      | 1     | **A**    | financial   |
| `POINTS_REDEEMED`     | 1     | **A**    | financial   |

**`REFERRAL_AUDIT_ACTIONS`** — 3 actions, 2 proposed Class A

| Action           | Sites | Proposed | Basis       |
| ---------------- | ----- | -------- | ----------- |
| `CODE_GENERATED` | 1     | B        | operational |
| `REDEEMED`       | 1     | **A**    | financial   |
| `REWARDED`       | 1     | **A**    | financial   |

**`integration`** — 7 actions, 2 proposed Class A

| Action               | Sites | Proposed | Basis          |
| -------------------- | ----- | -------- | -------------- |
| `created`            | 2     | B        | operational    |
| `credential_created` | 1     | **A**    | security-state |
| `credential_revoked` | 1     | **A**    | security-state |
| `deleted`            | 1     | B        | operational    |
| `disconnected`       | 1     | B        | operational    |
| `test`               | 4     | B        | no mutation    |
| `updated`            | 2     | B        | operational    |

**`DELIVERY_AUDIT_ACTIONS`** — 11 actions, 1 proposed Class A

| Action             | Sites | Proposed | Basis       |
| ------------------ | ----- | -------- | ----------- |
| `ACCEPTED`         | 1     | B        | operational |
| `ARRIVED`          | 1     | B        | operational |
| `ASSIGNED`         | 1     | B        | operational |
| `CANCELLED`        | 1     | B        | operational |
| `CASH_CONFIRMED`   | 1     | **A**    | financial   |
| `COMPLETED`        | 1     | B        | operational |
| `FAILED`           | 1     | B        | operational |
| `LOCATION_UPDATED` | 2     | B        | operational |
| `PICKED_UP`        | 1     | B        | operational |
| `REJECTED`         | 1     | B        | operational |
| `RETURNED`         | 1     | B        | operational |

**`PROMOTION_AUDIT_ACTIONS`** — 9 actions, 1 proposed Class A

| Action          | Sites | Proposed | Basis       |
| --------------- | ----- | -------- | ----------- |
| `ARCHIVED`      | 1     | B        | operational |
| `CLONED`        | 1     | B        | operational |
| `CREATED`       | 1     | B        | operational |
| `DELETED`       | 1     | B        | operational |
| `FORCE_EXPIRED` | 1     | B        | operational |
| `PAUSED`        | 1     | B        | operational |
| `REDEEMED`      | 2     | **A**    | financial   |
| `RESUMED`       | 1     | B        | operational |
| `UPDATED`       | 1     | B        | operational |

**`USER_AUDIT_ACTIONS`** — 1 actions, 1 proposed Class A

| Action            | Sites | Proposed | Basis            |
| ----------------- | ----- | -------- | ---------------- |
| `ACCOUNT_DELETED` | 1     | **A**    | legal/compliance |

**`ADDRESS_AUDIT_ACTIONS`** — 4 actions, 0 proposed Class A

| Action            | Sites | Proposed | Basis       |
| ----------------- | ----- | -------- | ----------- |
| `CREATED`         | 1     | B        | operational |
| `DEFAULT_CHANGED` | 2     | B        | operational |
| `DELETED`         | 1     | B        | operational |
| `UPDATED`         | 1     | B        | operational |

**`CART_AUDIT_ACTIONS`** — 6 actions, 0 proposed Class A

| Action         | Sites | Proposed | Basis       |
| -------------- | ----- | -------- | ----------- |
| `CLEARED`      | 1     | B        | operational |
| `CREATED`      | 1     | B        | operational |
| `ITEM_ADDED`   | 1     | B        | operational |
| `ITEM_REMOVED` | 1     | B        | operational |
| `ITEM_UPDATED` | 2     | B        | operational |
| `RECALCULATED` | 1     | B        | operational |

**`CMS_AUDIT_ACTIONS`** — 6 actions, 0 proposed Class A

| Action              | Sites | Proposed | Basis       |
| ------------------- | ----- | -------- | ----------- |
| `CONTENT_ARCHIVED`  | 1     | B        | operational |
| `CONTENT_CREATED`   | 1     | B        | operational |
| `CONTENT_DELETED`   | 1     | B        | operational |
| `CONTENT_PUBLISHED` | 1     | B        | operational |
| `CONTENT_SCHEDULED` | 1     | B        | operational |
| `CONTENT_UPDATED`   | 1     | B        | operational |

**`MESSAGING_AUDIT_ACTIONS`** — 1 actions, 0 proposed Class A

| Action | Sites | Proposed | Basis       |
| ------ | ----- | -------- | ----------- |
| `SENT` | 1     | B        | operational |

**`NOTIFICATION_CENTER_AUDIT_ACTIONS`** — 12 actions, 0 proposed Class A

| Action                | Sites | Proposed | Basis       |
| --------------------- | ----- | -------- | ----------- |
| `BROADCAST`           | 1     | B        | operational |
| `CREATED`             | 2     | B        | operational |
| `DEAD_LETTERED`       | 2     | B        | operational |
| `DELETED`             | 1     | B        | operational |
| `PREFERENCES_UPDATED` | 1     | B        | operational |
| `READ`                | 1     | B        | operational |
| `READ_ALL`            | 1     | B        | operational |
| `RESENT`              | 1     | B        | operational |
| `SENT`                | 1     | B        | operational |
| `TEMPLATE_CREATED`    | 1     | B        | operational |
| `TEMPLATE_DELETED`    | 1     | B        | operational |
| `TEMPLATE_UPDATED`    | 1     | B        | operational |

**`OPERATIONS_AUDIT_ACTIONS`** — 4 actions, 0 proposed Class A

| Action                  | Sites | Proposed | Basis       |
| ----------------------- | ----- | -------- | ----------- |
| `CASE_ASSIGNED`         | 1     | B        | operational |
| `CASE_NOTE_ADDED`       | 1     | B        | operational |
| `CASE_PRIORITY_CHANGED` | 1     | B        | operational |
| `CASE_STATUS_CHANGED`   | 1     | B        | operational |

**`PRODUCT_AUDIT_ACTIONS`** — 12 actions, 0 proposed Class A

| Action              | Sites | Proposed | Basis       |
| ------------------- | ----- | -------- | ----------- |
| `CREATED`           | 1     | B        | operational |
| `DELETED`           | 1     | B        | operational |
| `IMAGES_REORDERED`  | 1     | B        | operational |
| `IMAGE_ADDED`       | 1     | B        | operational |
| `IMAGE_REMOVED`     | 1     | B        | operational |
| `INVENTORY_UPDATED` | 2     | B        | operational |
| `PUBLISHED`         | 1     | B        | operational |
| `UNPUBLISHED`       | 1     | B        | operational |
| `UPDATED`           | 1     | B        | operational |
| `VARIANT_CREATED`   | 1     | B        | operational |
| `VARIANT_REMOVED`   | 1     | B        | operational |
| `VARIANT_UPDATED`   | 1     | B        | operational |

**`REVIEW_AUDIT_ACTIONS`** — 7 actions, 0 proposed Class A

| Action             | Sites | Proposed | Basis       |
| ------------------ | ----- | -------- | ----------- |
| `CREATED`          | 1     | B        | operational |
| `DELETED`          | 1     | B        | operational |
| `HELPFUL_VOTED`    | 1     | B        | operational |
| `MERCHANT_REPLIED` | 1     | B        | operational |
| `MODERATED`        | 1     | B        | operational |
| `REPORTED`         | 1     | B        | operational |
| `UPDATED`          | 1     | B        | operational |

**`SEARCH_AUDIT_ACTIONS`** — 2 actions, 0 proposed Class A

| Action              | Sites | Proposed | Basis       |
| ------------------- | ----- | -------- | ----------- |
| `DOCUMENT_UPSERTED` | 1     | B        | operational |
| `QUERY`             | 1     | B        | operational |

**`WISHLIST_AUDIT_ACTIONS`** — 8 actions, 0 proposed Class A

| Action          | Sites | Proposed | Basis       |
| --------------- | ----- | -------- | ----------- |
| `CREATED`       | 1     | B        | operational |
| `DELETED`       | 1     | B        | operational |
| `ITEM_ADDED`    | 1     | B        | operational |
| `ITEM_REMOVED`  | 1     | B        | operational |
| `ITEM_UPDATED`  | 1     | B        | operational |
| `MOVED_TO_CART` | 1     | B        | operational |
| `SHARED`        | 1     | B        | operational |
| `UPDATED`       | 1     | B        | operational |

---

## 8. What remains genuinely unresolved

Nothing in the 329 is left without a proposal except the single site named below. These are the
items where the proposal itself is the open question:

1. **`password.service.ts:224`** — no class proposed; the split is (§4).
2. **The operational/Class-A boundary** — 166 actions are proposed B on the judgement that a real
   mutation does not by itself earn atomicity. This is the largest single judgement in the
   document and the one most worth challenging.
3. **The five exclusions in §2** — order lifecycle, ride lifecycle, `INVENTORY_DEDUCTED`,
   `REFRESH_SUCCESS`, and configuration changes. Each has a stated counter-argument.
4. **The 8 Class A sites in the investigate band** (§6) — their remediation shape is not yet
   characterized, so their cost is unknown even though their class is proposed.
5. **The structural core** — whether `WalletService` accepts a caller-owned transaction or takes
   on audit responsibility itself. A design decision, deliberately not made.

---

## 9. Gate

**DX: RATIFICATION PREPARATION COMPLETE → HOLD for founder ratification.**

No implementation authorization. No code, migration, trigger, transaction-boundary or caller
change has been made, and none is proposed. §6 costs a proposal; it does not design a remediation.

| Record                              | State                                        |
| ----------------------------------- | -------------------------------------------- |
| DX Pass 1                           | `89c7aff`, unamended                         |
| DX Pass 2A                          | `9e5e787`, unamended                         |
| This proposal                       | new, additive                                |
| B8 Pass 1                           | `ca3b8b5`, unamended                         |
| `b8-sync`                           | `002feaf`, local only, clean — **B8 frozen** |
| `claude/p1-b8-archive-purge-6o3vb8` | `a152a25`, untouched                         |
| PR #351                             | untouched                                    |

On ratification, the outputs are: a ratified Class A set, a ratified Class B set, site-level
rulings for the five mixed actions, a naming decision for the `:224` split, and a decision on the
structural core. **Only then does an implementation plan become the next artefact.**
