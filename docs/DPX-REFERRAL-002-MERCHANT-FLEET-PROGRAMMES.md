# DPX-REFERRAL-002 — merchants and fleet owners get referral codes

**Status:** Shipped.
**Date:** 2026-09-11

---

## 1. Founder decision

> "Creates merchant and fleet owner referral programs."

Asked in the context of: _neither exists — what does each earn, for referring whom, into which
wallet?_ The instruction was given without those three answers, so this builds the programme using
decisions already locked rather than inventing new ones. §4 says exactly which questions that leaves
open.

---

## 2. What was missing

Merchants and fleet owners were the two earning personas with **no way to be credited for bringing
DrippleX a customer**, while a driver or rider doing the identical thing earned ₦350. There was no
`ReferralOwnerType` for either, so it was not a matter of configuration — there was no code to
share.

The Ops console referral screen reported them as "no programme exists" rather than as a row of
zeroes, precisely because a zero would have read as "nobody is referring" when the truth was "nobody
can". That notice is now gone, because they can.

---

## 3. What shipped

Both personas get a code on **the scheme that already exists**, unchanged in every respect that was
a founder decision:

| Element              | Value                                            | Where it came from                                                          |
| -------------------- | ------------------------------------------------ | --------------------------------------------------------------------------- |
| Who redeems the code | A new customer, at registration                  | Existing scheme — codes are only redeemable on the customer portal          |
| When it pays         | The referred customer's **first completed ride** | Locked anti-fraud rule: paying at signup makes self-registration free money |
| Amount               | ₦350 to each side                                | Founder decision, 2026-08-25 ("350 not 500")                                |

**Where the money lands** is the one thing that had to be decided per persona, because
`Referral.ownerType` is fixed when a code is created and chooses the wallet:

- **Merchant → the merchant wallet.** The balance their portal already shows and can withdraw from,
  matching the principle the driver and rider splits were built on.
- **Fleet owner → their personal wallet.** A fleet _has no wallet_: what DrippleX owes it arrives as
  an Ops-approved settlement receivable for work its riders did. A referral is not that — it is the
  owner's own marketing, earned by the person. Filing it as a receivable would put personal earnings
  behind the fleet's approval queue and into the fleet's books.

### Surfaces

- `GET /merchant/referrals/me` + `/stats`, on a new `merchant:referrals:use`.
- `GET /fleet/referrals/me` + `/stats`, on a new `fleet:referrals:use`.
- **Merchant portal**: a "Refer customers" card on the wallet page, next to DX points redemption —
  which is the point. Now that points are spendable in store, a merchant has a direct reason to want
  those customers on DrippleX. The card states plainly that the reward comes on the referred
  customer's first ride, **not at signup**, because a merchant who thinks signups pay will conclude
  the scheme is broken.
- **Fleet owners are API-only**, as they are everywhere else on the platform — there is no fleet app.
- **Ops console** now shows five persona programmes side by side.

A separate permission and controller per persona, rather than one shared route, for the reason that
split already existed: a merchant issued a code under the customer permission would have their
reward filed as a customer's and paid into a wallet their portal does not show.

### A contract gap fixed on the way

`ReferralStatsDto` in `@dripplex/types` never declared `referrerRewardAmount`, though the endpoint
has always returned it. Any client reading it had to hardcode the amount or go without — and
hardcoding a reward amount is how the customer app once ended up promising an unapproved ₦500 on
screen. Now declared.

### Verification

- 259 suites / 2563 tests green against a fresh, migrate-only, never-seeded Postgres with `CI=true`.
- `pnpm lint` 17/17, `pnpm typecheck` 18/18, schema/migration parity exact.
- New tests assert the thing the owner-type split exists for: a merchant referrer is paid into the
  **merchant** wallet, a fleet owner into their **personal** wallet, and the Ops console gives each
  persona its own leaderboard with no bleed between them.

---

## 4. Still open

### 4.1 Merchant-to-merchant and fleet-to-fleet referrals

This programme is **refer a customer**. It is not merchant-refers-merchant or
fleet-owner-refers-driver, and that is a deliberate limit rather than an oversight: referral codes
are only redeemable at **customer** registration (`RegistrationService`, `portal === 'customer'`),
and the qualifying event is a completed ride. A referred merchant may never take a ride, so the
reward would never pay.

Opening that up needs a founder decision on **what qualifies a non-customer referral** — a merchant's
first completed order as a seller, a fleet's first job, a driver's first trip — because the money
cannot be released on registration alone without recreating the fraud the ride rule exists to
prevent.

### 4.2 Whether merchant and fleet rewards should differ from ₦350

Both currently pay the standing amount, which is the only figure ever approved. A merchant sending
regular footfall and a customer telling one friend are arguably not worth the same, but nobody has
said so. Changing it is a one-line constant per persona once decided.
