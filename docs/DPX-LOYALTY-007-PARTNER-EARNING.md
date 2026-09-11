# DPX-LOYALTY-007 — partners earn DX Points, where a programme allows it

**Status:** Shipped (backend).
**Date:** 2026-09-11

---

## 1. What was asked

Nora's policy, 2026-09-11:

> Drivers and riders earn DX Points per approved programme. Merchants where a campaign permits.
> Fleets only via explicit incentive programmes.

And the founder, the same day:

> "Review can boost driver dx points but cannot affect the star rating."

## 2. The starting position

**No partner earned DX Points at all.** Every one of the four earning events — order paid, delivery
completed, customer registered, coupon redeemed — credits the _customer_. Verified against the
subscriber rather than assumed.

That matters, because it means the rule Nora is asking for is not a restriction on something
currently happening. It is the design for switching something on that has never been on. So every
programme ships **inactive**, and nothing in this change moves a single balance.

## 3. What shipped

`LoyaltyEarningProgramme`, one row per partner persona, all seeded off:

| Persona     | Per job | Per qualifying review | Review bar | Daily cap |
| ----------- | ------- | --------------------- | ---------- | --------- |
| DRIVER      | 20      | 50                    | 4★         | 2,000     |
| RIDER       | 20      | 50                    | 4★         | 2,000     |
| MERCHANT    | 10      | —                     | 4★         | 5,000     |
| FLEET_OWNER | 0       | —                     | 4★         | —         |

Those figures are a starting proposal an operator edits before switching anything on; they buy
nothing while `active` is false. At 200 points to the naira, a driver's 20 points a trip is 10 kobo.

**Three policies, one mechanism.** "Approved programme", "where a campaign permits" and "explicit
incentive programme" all mean the same operational thing — somebody switched it on, and the switch
is audited. Building three mechanisms for one idea is how they drift apart.

**FLEET_OWNER earns zero per job by design.** What a fleet is given is an explicit incentive, not a
per-trip drip, and nobody has specified one. The row exists so the persona is configurable rather
than absent; it does nothing until both a number and the switch are set. Points reach the _owner_,
because a fleet has no loyalty account — the same reasoning as its referral reward.

### The review rule

Founder decision: a review boosts DX Points and never touches the star rating. That is enforced by
construction rather than by care:

- `RideRatingService` records the rating and **emits** `RIDE_RATED`. It does not call loyalty.
- `LoyaltyEarningService.awardForReview` **only adds points**. It does not read the rating average,
  cannot write to it, and a review below the bar earns nothing rather than deducting anything.
- A points system that subtracted on a bad review would be a star rating by another name, which is
  exactly the separation the decision draws. There is a test asserting no negative line is ever
  written by this path, and one asserting a review award touches the points ledger only.

Only a _customer rating a driver_ counts. A driver rating their passenger is the other direction,
and paying for it would reward the act of rating rather than the service.

### Other details

- **Exactly once per job or review.** Keyed on the reference pair, so a replayed completion event
  pays once. One order can still pay both its customer and its merchant — they use different
  reference types, so neither looks like a replay of the other.
- **The daily cap pays the headroom**, not all-or-nothing: a driver with 10 points of room left gets 10. Rolling 24 hours rather than a calendar day, for the same reason the cash-out cap is.
- **An award never breaks the work.** Loyalty is a reward beside a ride or an order, never a
  condition of it, so a failure here is logged and swallowed — the same discipline the customer-side
  subscriber has always had.
- `RIDE_COMPLETED` now carries `driverId`. It always had the customer; a partner programme cannot
  credit somebody the event does not name.

### Verification

- 11 database tests: a switched-off programme paying nothing, payment starting only once approved,
  each persona behind its own switch, a job paying exactly once across three replays, a good review
  boosting points, a bad review earning nothing and never deducting, review points landing as EARNED
  on the points ledger only, the cap stopping payment, the cap paying the headroom, a review bar
  outside 1–5 refused, and every persona seeded off.
- Proven load-bearing: removing the `active` gate turns 2 of them red.

## 4. A near-miss, again worth recording

The first attempt at that mutation check reported everything still green — because `eslint --fix`
had rewritten the guard into an optional chain and the text being deleted no longer existed. The
mutation silently did nothing.

Same lesson as DPX-LOYALTY-006's: a mutation check is only evidence if the mutation actually
applied. Both are now confirmed against the real text.

## 5. Still open

- ~~No Ops console screen.~~ **Shipped** — `/loyalty/earning`. See §6.
- **No per-campaign merchant gating.** "Where a campaign permits" is implemented as the merchant
  programme switch rather than as a link to a specific `Promotion`. If a campaign should carry its
  own points rule, that is a further step.
- **Partner points expire on the customer clock** (365 days) and are spendable through the same
  cash-out and in-store paths. Nothing in the policy says a partner's points should behave
  differently, so they do not.

---

## 6. The Operations screen

`/loyalty/earning`, under **Money** in the console — because switching one of these on is a
commitment to pay people, not a marketing setting.

The form is the easy part. The point of the screen is that **switching DRIVER on starts paying every
approved driver on the platform on their next trip**, and this is the only place anybody is in a
position to realise it. So:

- **The blast radius is on screen before the switch is reachable.** Each card states how many
  eligible partners the programme would begin paying — approved drivers, approved riders, verified
  merchants, active fleets, not everyone registered.
- **Switching on asks a second time**, and the confirmation carries the number: _"this starts paying
  N approved drivers on their next job… at the daily cap, at most ₦X a day."_
- **Switching off does not ask.** It is not the dangerous direction: it stops future earning and
  takes nothing already earned. Making both directions equally effortful trains people to click
  through the one that matters.

**The worst case, not a forecast.** A forecast needs assumptions about how many trips a driver does
in a day, and an operator cannot check my assumptions. Every eligible partner hitting their cap on
the same day needs none and cannot be exceeded, which makes it the one figure safe to put beside a
switch.

**An uncapped programme shows no number at all**, and says so: _"there is no daily cap, so there is
no ceiling on what this can cost."_ The absence is the warning rather than a gap in the screen.

**Points are always shown with their naira value.** "20 points" means nothing on its own; "20 points
(10 kobo)" is a decision somebody can make. The rate comes from the live loyalty setting, so the
screen follows a re-pricing rather than quoting a stale 200:1.

**The founder's review rule is printed where it matters** — beside the review points field, because
that is exactly where somebody might otherwise assume points and stars are the same dial.

### Also shipped to reach it

- `GET /admin/loyalty/earning-programmes/impact` — the counts and ceilings above.
- `AdminLoyaltyClient` in the SDK. There was no admin loyalty client at all, so it also picks up the
  settings read/write from DPX-LOYALTY-005 and the manual adjustment from DPX-LOYALTY-006, which
  were endpoints nothing could call.

### Still open on the screen

- **No naira estimate for the review points**, only for the job points and the cap. Reviews are far
  harder to bound — they depend on how many customers bother to rate — and a number I cannot stand
  behind is worse than none.
- **No history of who switched what on.** Every change is audited server-side; the screen does not
  show it.
- **Still no screen for the loyalty settings or manual adjustments** (DPX-LOYALTY-005 / 006), though
  the SDK now reaches both.
