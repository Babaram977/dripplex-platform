# DPX-REFERRAL-003 — a referral has a life, not a switch

**Status:** Shipped (backend).
**Date:** 2026-09-11

---

## 1. What was asked

Nora's Rewards, Campaign & Referral policy, 2026-09-11:

> Referral states `PENDING / QUALIFIED / APPROVED / PAID / REVERSED / EXPIRED / REJECTED`.
> Qualification milestones: customer — verification and a first qualifying paid transaction;
> merchant — KYC, bank account and a first order; fleet — vehicles, bank account and activation.
> ₦350 customer and merchant referral, ₦2,500 configurable fleet referral. A 7-day hold before
> payment. Anti-abuse: self-referral, duplicate relationship, device / phone / email / identity
> checks. Everything configurable, nothing hard-coded.

---

## 2. What referrals were before this

Three states — `PENDING`, `REWARDED`, `EXPIRED` — two constants, and one trigger.

A referral was redeemed at a customer's registration and paid the instant the referred customer
completed their first ride: both wallets credited inside the same call that noticed the ride.

Two things that arrangement could not say:

- **"Earned, not yet payable."** There was no gap between deciding a referral was genuine and
  putting the money in a wallet the referrer can withdraw from. Fraud discovered a day later was
  discovered after the money had gone.
- **"Paid, and taken back."** `REWARDED` was terminal. A reversal could only be represented by
  editing the row into a lie.

And three things it could not do at all: charge a different amount for a different kind of referee,
change any amount without a deployment, or notice that the two accounts were one person.

## 3. What this ships

### 3.1 The lifecycle

```
  PENDING ──(milestone met, screening clean)──▶ QUALIFIED
     │                                             │
     │ (window closed)                             │ (hold elapsed)
     ▼                                             ▼
  EXPIRED                                       APPROVED
     ▲                                             │
     │                                             │ (wallets credited)
  REJECTED ◀──(screening or Operations)──┬─────────▶ PAID ──▶ REVERSED
```

`REWARDED` became `PAID` rather than being kept beside it. Two names for "the money moved" is a
trap: every query that forgets one of them is wrong, and the one that decides whether to pay again
is wrong about money. The migration renames the state on existing rows, which changes nothing about
what any of them were paid.

### 3.2 Programmes — the numbers are rows

`ReferralProgramme`, one row per kind of referee:

| Referee  | Referrer | Referee | Hold   | Window   |
| -------- | -------- | ------- | ------ | -------- |
| Customer | ₦350     | ₦350    | 7 days | 90 days  |
| Merchant | ₦350     | ₦350    | 7 days | 180 days |
| Fleet    | ₦2,500   | ₦0      | 7 days | 180 days |

Every cell is an Operations setting. A fleet pays the referrer only: a company is signed up by its
owner as a business, not tempted in by a welcome bonus, and a referee amount of zero means no credit
is attempted rather than a ₦0 wallet movement the wallet would refuse.

**₦2,500 is naira.** It is a reward amount in the same column as the ₦350, on a programme that
credits wallets — not a points threshold. There is a test asserting both figures side by side so the
two kinds of number cannot be conflated later.

### 3.3 Qualification — asked, not listened for

| Referee  | Milestone                                                               |
| -------- | ----------------------------------------------------------------------- |
| Customer | A first completed ride **or** a first completed order                   |
| Merchant | Business verified, a bank account on file, and a first completed order  |
| Fleet    | Activated by Operations, a bank account, and at least one active member |

Milestones are evaluated by **asking the database what is true now**, rather than by catching the
moment it became true. A ride event lost to a restart costs a delay rather than a reward; a referral
redeemed before its programme existed still qualifies the first time the sweep looks at it; and
there is one set of rules rather than one per event emitter. The ride-completed subscriber survives
as a prompt to look sooner, not as the rule.

Fleet members are counted `ACTIVE` only. A rider who typed a fleet's DX number during onboarding is
`PENDING` until the owner confirms them, and anybody can type any number — counting those would let
a fleet qualify on riders it never employed.

### 3.4 The hold

Seven configurable days between qualifying and being paid. The reason it exists: a referral
collected through a fake account is usually visible inside a week, and money already withdrawn
cannot be clawed back. `holdDays: 0` restores what the platform did before this shipped.

### 3.5 Anti-abuse

Screening runs **at qualification**, not at signup. At signup there is nothing to screen and
refusing there means telling somebody their code did not work; at qualification there are sessions,
documents and a transaction history to compare, and the referral is refused before any money moves.

| Signal                   | Outcome     |
| ------------------------ | ----------- |
| Self-referral            | Rejected    |
| Reciprocal relationship  | Rejected    |
| Shared phone line        | Rejected    |
| Shared email inbox       | Rejected    |
| Shared identity document | Rejected    |
| **Shared device**        | **Flagged** |

Two of these needed care, because the obvious implementation is a check that can never fire.
`User.phone` and `User.email` are unique columns, so comparing them directly is dead code that reads
like fraud control. What actually happens is the same phone written differently and the same inbox
addressed differently, so both are compared normalised: a phone down to its national significant
digits (`+2348012345678`, `2348012345678` and `08012345678` are one line), and an email with dots
and `+tags` removed **only on providers that ignore them** — collapsing them everywhere would merge
two different people's mailboxes and reject a real referral.

**Shared device flags rather than refuses.** A household sharing a handset is routine in this
market; two accounts on one identity document is not. Refusing on the weak signal would reject real
referrals in bulk, so it is held for review — which is what the hold is for. Operations clears the
flag (recorded against the operator who cleared it) or rejects it.

### 3.6 Reversal

`reverse` debits both wallets, keyed on the redemption id the same way the credits were, so a replay
does not double-debit.

It can fail, and failing is the right outcome: the wallet refuses a debit that would overdraw, so a
referrer who has already spent the reward cannot be reversed. That is a real limit of clawing money
back after it has moved. The hold is what exists to stop it happening, and letting a wallet go
negative would only move the loss somewhere less visible.

### 3.7 Intake

- **Customer** — unchanged, at registration.
- **Merchant** — the `referralCode` field has always been on the shared portal DTO; until now a
  merchant who typed one had it silently dropped, which reads to both sides as the code not working.
- **Fleet** — `POST /fleet/register` takes an optional code. It is the only place a fleet signup can
  be attributed: the owner already had a DrippleX account before they registered the company.
- **Driver and rider portals are deliberately still excluded.** No programme is priced for either,
  and a referral with no programme cannot qualify — recording one would promise a reward nothing has
  agreed.

### 3.8 Operations API

`GET/PATCH /admin/referrals/programmes`, and `approve` / `reject` / `reverse` on a redemption. All
under the existing `admin:referrals:manage` permission — no new permission, because this is the same
authority over the same money.

### Verification

- 13 database tests: the hold, the amount snapshot surviving a re-pricing, payment idempotent across
  three replays, a shared phone line refused, a shared device flagged and held despite a zero hold,
  an operator clearing a flag, expiry, reversal moving money back, rejection refused on a paid row,
  a customer qualifying on an order rather than a ride, the merchant three-part gate step by step,
  and the fleet programme priced at ₦2,500 / ₦0.
- 9 unit tests on the normalisation the phone and email checks depend on.
- 4 sweep tests: re-entrancy, and a failing pass not taking the interval with it.
- Proven load-bearing: removing the flag guard in `tryApprove` turns 2 tests red.

---

## 4. Deliberate changes to existing financial behaviour

Both are stated here rather than buried, because they change who gets paid.

### 4.1 A completed order now qualifies a customer referral

Before this, only a completed ride did. A referred customer who orders food every week and has never
taken a ride left their referrer unpaid forever — the referral did exactly what DrippleX wanted and
paid nobody. Nora's specification says "a first qualifying paid transaction", and a completed order
is one.

**Effect:** more referrals pay than before. Nothing that paid before stops paying.

### 4.2 Rewards now wait seven days

Money that landed immediately now lands a week later. Nobody earns less; it arrives later, and the
delay is what makes a fraudulent referral reversible at all. Configurable to zero without a
deployment.

### 4.3 What was NOT changed, and why

Nora's customer milestone is "**verification** and a first qualifying paid transaction". The
verification half is shipped as `requireKycVerified` on the programme row and **seeded false**.

DrippleX pays a customer referral today on the first completed ride with no verification gate.
Switching one on silently would stop paying referrals that are earned under the rule currently in
force — a tightening of a live money rule, which is not something to apply on my own reading of a
specification. It is one Operations toggle away, with no deployment, whenever that is the decision.

---

## 5. Still open

- **No Ops console screen** for programmes or the flagged-referral review queue. The API is there;
  the queue is `status = QUALIFIED AND flagged_reason IS NOT NULL`. Until a screen exists, a flagged
  referral waits indefinitely rather than being looked at — this is the most important follow-up in
  this document.
- **Driver and rider referee programmes** are unpriced, so neither portal accepts a code.
- **`ReferralFraudCheck`** (the driver-campaign module's own fraud model) and this screening are two
  separate mechanisms over the same idea. They should converge; they have not been merged here
  because the driver campaign's rewards are a different ledger and merging them blind would mix two
  sets of money.
- **Device identity is only as good as the client that sends it.** `AuthSession.deviceId` is
  self-reported, which is the other reason that signal flags rather than refuses.
