# DPX-MERCHANT-016 — a commission rate agreed with one merchant

Founder decision 2026-09-11: _"Add per-merchant negotiated rate column like fleet has."_

## 1. What was missing

Every merchant shared one platform-wide rate — the `MerchantCommissionSetting` singleton. The only
way to give a single shop a different one was a **commission campaign**: a time-boxed instrument
with a start and an end, pressed into service to express a standing agreement. That is the shape of
mistake that works until somebody forgets to renew it, and then a merchant is silently back on the
default rate they never agreed to.

`Fleet` already had the right instrument (`negotiatedRate`, added 2026-08-30), and
`CommissionAccount.negotiatedCreditLimit` had it for credit. Merchants had it for neither, despite
the reasoning being recorded for merchant credit limits on 2026-08-20: _"limit should be
individually set to each merchant because of business difference and it should be negotiated and
agreed by DrippleX and merchant."_ A supermarket and a jeweller cannot share one rate.

## 2. The column

`merchant_profiles` gains the same four fields `fleets` carries, deliberately identical so the two
cannot drift:

| Column                            | Meaning                                                                     |
| --------------------------------- | --------------------------------------------------------------------------- |
| `negotiated_rate` `DECIMAL(5,4)`  | Fraction, not percent. NULL means no agreement exists.                      |
| `negotiated_by` `UUID`            | Who agreed it.                                                              |
| `negotiated_at`                   | When.                                                                       |
| `negotiation_note` `VARCHAR(500)` | What was agreed, readable months later by somebody who was not in the room. |

Nullable with no default, so the migration leaves every existing merchant exactly as they were.
NULL is a different statement from any number — "no agreement" rather than "we agreed the default" —
and keeping them distinct is what stops a cleared agreement being indistinguishable from one that
was never made.

## 3. Precedence — **LOCKED**

> **Campaign → Negotiated merchant rate → Platform rate**
>
> Locked by founder/architecture review, 2026-09-11 (Nora, approved by Saeed).
> **Do not change the financial precedence without explicit approval.**

A negotiated rate is the merchant's **standing commercial rate**. A campaign is **exceptional
promotional pricing** that may temporarily override it for the campaign's eligible window and
transactions. When the campaign ends, resolution returns to the negotiated rate automatically —
nothing re-applies the agreement, because the agreement is what resolution falls back to.

The worked example from the review, which is now a test: a merchant agreed at **8%** who joins a
campaign at **5%** pays 5% while it runs, and 8% again the moment it stops.

Four tests under `LOCKED precedence: campaign > negotiated > platform` make reordering this a
failing build rather than a discovery on somebody's invoice. Inverting the lock in the source fails
three of them.

A campaign outranks an agreement for the window it covers. This is not a compromise; it is the same
ordering `Fleet` already uses, where `blendedCommission` charges the campaign rate for the segments
a campaign covered and the fleet's own rate for the remainder. An agreed rate is what a merchant
pays _normally_ — not a promise that no promotion will ever beat it.

The implementation expresses this in one line rather than a branch: the merchant's own rate is
passed to the resolver **as the standing rate**, and `CommissionRateResolverService.resolve` already
returns a matching campaign or the standing rate otherwise.

```ts
const standingRate = await this.commissionSettings.standingRateFor(order.merchantId);
const resolved = await this.commissionRates.resolve(MERCHANT_ORDER, standingRate, ctx);
```

Everything is keyed on the **merchant profile id**, which is what `Order.merchantId` and
`OrderSettlement.merchantId` hold — not the user id. Passing the user id reads as "no agreement" and
silently bills the platform rate, which surfaces on somebody's invoice rather than in a stack trace.

Changing the platform rate never disturbs an agreement.

### 3.1 A settled sale is history, not a view

Also locked 2026-09-11: _"Preserve the negotiated rate as a historical snapshot on financially
settled transactions so changing a merchant's agreement later cannot alter historical
settlements."_

`OrderSettlement.commission_rate` already snapshotted **what** was charged, so no past sale could be
re-priced. What it could not answer was **why** that figure applied: when a campaign set it the row
carried no trace of the merchant's standing agreement, and when no campaign ran it could not tell an
agreed rate from a platform default that happened to match.

`order_settlements.negotiated_rate` closes that. The three fields together make a charge fully
explicable from the row alone:

| `commission_campaign_id` | `negotiated_rate` | What the row says                                               |
| ------------------------ | ----------------- | --------------------------------------------------------------- |
| set                      | set               | A campaign overrode the agreement; both rates are on the record |
| set                      | null              | A campaign applied to a merchant with no agreement              |
| null                     | set               | The agreement applied, and `commission_rate` equals it          |
| null                     | null              | The platform rate applied, and `commission_rate` is it          |

**Deliberately not backfilled.** NULL means "no agreement was in force", which is true of every row
written before this existed — merchants had no negotiated rate to be in force. Writing today's
agreement onto a sale that settled before it was made would invent history, which is the precise
failure the column exists to prevent.

## 4. Where it is set and seen

- **Operations set it** on the merchant detail page (`merchant-commission-rate.tsx`), entered as a
  percentage because that is how the conversation actually happens — "we agreed seven and a half".
  The conversion to a fraction lives in that one component.
- **`POST /admin/merchant-settlement/commission/:merchantProfileId/rate`** — `rate: null` clears the
  agreement, taking the note with it, because a note left behind would describe terms that no longer
  apply. Audited as `merchant_commission.rate_negotiated`.
- **The merchant sees it** in the super-app: a rate that came from an agreement is labelled
  "(your agreed rate)", so a merchant who negotiated one can see it is the rate being applied rather
  than take that on trust. While a campaign runs, the campaign is named instead — calling a campaign
  rate "your agreed rate" would tell a merchant their agreement had changed when it had not.

## 5. Verification

Nine service tests covering settlement, the merchant-facing terms, precedence against a campaign,
clearing, the recorded terms, the fraction bounds, an unknown merchant, and the platform rate moving
under an agreement. Two client tests for the label. Every guard mutation-proven.

One mutation needed a second attempt, which is worth recording because it is the same trap as the
last three times: removing the "merchant not found" guard left the suite **green**, because Prisma's
own P2025 error message also reads _"...required but not found"_, and the test matched on the
message. Asserting the exception **type** distinguishes a handled refusal from an unhandled ORM
error leaking out as a 500 — and with that change the mutation fails as it should.

Full backend suite green on a fresh never-seeded Postgres with `CI=true` (271 suites, 2718 tests).
Migration/schema parity clean. Super-app 192 tests, production build clean. Repo-wide `pnpm
typecheck` green across all 18 packages.

## 6. Deliberately not built

- **No per-merchant rate on the merchants _list_.** The agreement is shown and edited on the detail
  page. A column on the list is a reasonable follow-up; it is not needed to agree a rate.
- **No scheduled or expiring agreement.** An agreement runs until it is changed. A rate that should
  end on a date is a campaign, which already exists.
- **Zero commission cannot be expressed here — confirmed and locked 2026-09-11.** Four tests pin the
  boundary: 0, 1, a negative, and a percentage mistaken for a fraction are all refused.
