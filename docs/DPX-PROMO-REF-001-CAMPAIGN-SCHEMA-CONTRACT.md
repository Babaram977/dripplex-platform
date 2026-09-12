# DPX-PROMO-REF-001 — Campaign schema contract

Status: **contract for inspection. No migration written.** Every claim below is
cited to the file and line it was read from, on `main` at `21150be3` plus
increment 1 (`62c793dc`).

---

## 0. The audit that had to come first

The founder asked, before the schema was finalised, whether `Promotion`'s
budget/redemption transaction semantics can safely represent a **promoter
payout**, rather than assuming that because `Promotion` can express the 20% ride
discount it can also express paying an influencer.

**Answer: no. It cannot, and the difference is not cosmetic.** Four findings,
each from the code rather than from the model's shape:

1. **`PromotionRedemption` has no status column at all** — the finding the
   other three follow from. Read the model (`schema.prisma:3965`): `id, promotionId, userId, orderId, referenceType,
referenceId, deviceId, walletTransactionId, amountSaved, createdAt`. It is
   created once and is terminal. There is no PENDING, no hold, no APPROVED, no
   REVERSED. A referral reward must sit unpaid through a hold period and survive
   anti-abuse screening before money moves; a promotion redemption has nowhere
   to sit.

2. **It can move money, but only to the redeeming user and only immediately.**
   This correction matters, because the first reading of the redemption
   transaction (`:808-830` — create the redemption, increment `budgetSpent`, no
   wallet call) suggests `Promotion` never pays anyone. It does:
   `creditWalletForRedemption` (`:1176-1213`) credits a wallet for
   `WALLET_CREDIT` and `CASHBACK` promotions.

   But look at **who** and **when**. It credits `userId` — the person who
   redeemed — against `PROMOTION_WALLET_REFERENCE_TYPE`, and it pays the moment
   the promotion is redeemed. A promoter payout is neither: the redeemer is the
   referred customer, the payee is a third party who redeemed nothing, and the
   money must **not** move until a hold has elapsed and anti-abuse has cleared.

   So the gap is not "cannot pay". It is that there is **no state in which a
   reward can wait**, and no way to pay anyone but the redeemer.

   One further detail found while checking this: the credit is issued _after_
   the serializable transaction closes (`:876-882`), so it is not atomic with
   the redemption row and the `budgetSpent` increment. For a discount that is
   tolerable — the customer already got their money off. For a payout it is
   not, and `ReferralLifecycleService` handles exactly that case by making the
   status transition a compare-and-swap the sweep can safely retry
   (`:397`), which `PromotionRedemption` has no status to do.

3. **It is bound to an order.** `orderId: order.id`, `referenceType: 'order'`,
   and the duplicate guard is `findFirst({ promotionId, orderId })`
   (`:795-813`). A promoter payout has no order behind it — it is earned by
   somebody _else's_ first completed ride.

4. **`perUserLimit` counts the wrong user.** It counts redemptions by the
   redeeming customer (`:780-786`). For a payout the natural "user" is the
   promoter, and "how many times may this promoter be paid" is a different
   question with a different answer.

By contrast the payout engine already exists and already does all of this.
`referral-lifecycle.service.ts` runs `PENDING → QUALIFIED → APPROVED → PAID`
with `REVERSED` beyond it (`:82`), advances by compare-and-swap
(`updateMany({ where: { id, status: X } })`, `:281/:351/:397`) so two sweeps
cannot double-pay, and pays with `walletService.credit()` from the amounts
**snapshotted on the redemption row** (`:368-395`).

**Therefore the contract is a split, not a merge:**

| Concern                                     | Owner                                             | Why                                                                                                                                                     |
| ------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Campaign identity, lifecycle, budget, dates | `Promotion`                                       | Already has status, `startsAt`/`endsAt`/`pausedAt`/`archivedAt`, `budgetAmount`/`budgetSpent` with atomic spend                                         |
| Customer-side 20% off first 3 rides         | `Promotion`                                       | `type: PERCENTAGE`, `domains: [RIDE]`, `percentOff: 20`, `perUserLimit: 3` — a customer discount bound to a ride, which is exactly what this table does |
| Promoter payout                             | `ReferralRedemption` + `ReferralLifecycleService` | Already has the lifecycle, the hold, the anti-abuse gate, the snapshot and the wallet credit                                                            |
| Campaign ↔ promoter ↔ private token         | **new `CampaignPromoter`**                        | Nothing today can express it                                                                                                                            |

They meet at the campaign, not in one table. No second campaign system is
created: `ReferralCampaign` is **not** extended and **not** made the foundation.

---

## 1. Campaign — represented by `Promotion`

Nothing new. Verified already present:

- Lifecycle: `PromotionStatus` is `DRAFT SCHEDULED ACTIVE PAUSED EXPIRED ARCHIVED
CANCELLED` (`schema.prisma:3438`), with `pausedAt`/`archivedAt` columns. The
  founder's Active/Paused/Ended maps onto ACTIVE / PAUSED / EXPIRED|ARCHIVED.
- Dates: `startsAt`, `endsAt`.
- Budget ceiling: `budgetAmount` + `budgetSpent`, incremented inside the same
  locked transaction that records the redemption, so "two simultaneous checkouts
  cannot both spend the last of the budget" is already true.
- `PromotionType.REFERRAL` and `PromotionDomain.RIDE` already exist
  (`:3415`, `:3431`).

**Simultaneous campaigns are already allowed.** `Promotion` has no
period-uniqueness constraint. This is precisely why `ReferralCampaign` is not the
foundation: its `@@unique([periodStart, periodEnd])` (`:4875`) forbids two
campaigns in one month, which the founder identified as unacceptable.

**Campaign-specific reward configuration** is the one thing `Promotion` does not
carry, because its money columns describe a _discount to a customer_, not a
_payment to a promoter_. That lives on `CampaignPromoter` (§4).

## 2. Promoter participation — new `CampaignPromoter`

```
model CampaignPromoter {
  id              String                  @id @default(uuid()) @db.Uuid
  promotionId     String                  @map("promotion_id") @db.Uuid
  userId          String                  @map("user_id") @db.Uuid
  participantType CampaignParticipantType @map("participant_type")
  token           String                  @unique @db.VarChar(32)

  // Campaign-specific reward. Exactly one of cash/points is set — see §4.
  referrerRewardAmount Decimal? @map("referrer_reward_amount") @db.Decimal(12, 2)
  referrerRewardPoints Int?     @map("referrer_reward_points")

  status     CampaignPromoterStatus @default(ACTIVE)
  addedBy    String?   @map("added_by") @db.Uuid
  addedAt    DateTime  @default(now()) @map("added_at")
  removedBy  String?   @map("removed_by") @db.Uuid
  removedAt  DateTime? @map("removed_at")

  @@unique([promotionId, userId])
  @@index([token])
  @@map("campaign_promoters")
}

enum CampaignParticipantType {
  CUSTOMER
  RIDER
  DRIVER
  PIONEER_DRIVER
  INFLUENCER
  CREATOR
  AMBASSADOR
}

enum CampaignPromoterStatus { ACTIVE  REMOVED }
```

**Pioneer driver is a participant type here, not a `ReferralOwnerType`.** That
distinction is load-bearing and comes from the existing schema's own reasoning.
`ReferralOwnerType` decides _which wallet the reward is paid into_
(`schema.prisma:4648`: "Whose referral code this is, and therefore which wallet
their reward is paid into"). A pioneer driver's wallet is a driver's wallet — the
₦350 is a different _rate_, not a different _destination_. Putting
`PIONEER_DRIVER` into `ReferralOwnerType` would encode a price in a field whose
job is routing, and `REFERRER_WALLETS[ownerType]` (`referral-lifecycle.service.ts:373`)
would need a wallet type that does not exist.

**Remove never deletes.** `status: REMOVED` + `removedAt`/`removedBy`. No row is
deleted, and §3 makes historical attribution survive independently anyway.
Resolution of an incoming token refuses a REMOVED promoter for _new_ referrals
and leaves every existing `ReferralRedemption` untouched.

## 3. Private attribution token

- `CampaignPromoter.token` is its own unique column, generated opaque. The type
  and ownership live in the row, never parsed from a prefix.
- **It is not `Promotion.code`.** `Promotion.code` is the public campaign coupon
  (`schema.prisma:3893`). A promoter token must never be a public code.
- **It is not `Referral.code`.** That is the public per-user referral code, one
  per user (`Referral.userId @unique`, `:4675`; `code` at `:4678`), 16 chars.
- **Cross-table collision is a real risk and is designed for, not hoped about.**
  Three tables now hold redeemable strings (`referrals.code`, `promotions.code`,
  `campaign_promoters.token`), and one resolver decides what an incoming string
  means. Per the founder ruling: the token is cryptographically generated,
  normalised before lookup, unique at the database level, and resolved through
  the **campaign-promoter namespace explicitly** — no string is ever asked to
  serve as all three. If a supplied string is ambiguous across the legacy
  namespaces the resolver **rejects it rather than guessing**, because guessing
  attribution wrong pays the wrong promoter.

  Concretely: 32 chars from a CSPRNG over the existing unambiguous alphabet
  (`REFERRAL_CODE_ALPHABET`, which already excludes 0/O and 1/I/L so a code read
  aloud is not mistyped), upper-cased on write and on lookup. Length alone
  separates it from `referrals.code`, which is `VarChar(16)` and generated at 8
  (`referral.constants.ts:REFERRAL_CODE_LENGTH`), but length is a convenience for
  humans reading logs, **not** the guarantee — the guarantee is that lookup is
  namespaced to one table.

**Immutable historical attribution:** `ReferralRedemption` gains

```
  campaignPromoterId String? @map("campaign_promoter_id") @db.Uuid
```

Nullable, so every row that predates campaigns is valid and untouched — the same
pattern `programmeId` already uses ("Nullable for every row that predates
programmes", `:4760-4762`). Once written it is never rewritten, which is what makes
`campaign → promoter → token → referred customer → qualification → reward`
answerable for a promoter who was later removed.

## 4. Reward — cash or DX Points

The existing snapshot discipline is kept exactly: `ReferralRedemption` already
carries `referrerRewardAmount` / `refereeRewardAmount`, null until qualification,
because "Operations re-pricing a programme must never rewrite what somebody
already earned" (`:4766`). Campaign rewards snapshot into the same columns.

Locked economics. **The promoter side is configuration on `CampaignPromoter`;
the referee side is not.** Founder ruling: the referred customer's ₦150 is fixed
platform-wide through `ReferralProgramme.refereeRewardAmount` and is deliberately
**not** per-campaign editable, so no campaign can outbid another for the same
acquisition. Only the promoter's rate varies by participant class:

| Referral                  | Referrer (per-campaign) | Referred customer (platform-wide) |
| ------------------------- | ----------------------- | --------------------------------- |
| Customer → Customer       | ₦150                    | ₦150                              |
| Driver → Customer         | ₦200                    | ₦150                              |
| Pioneer Driver → Customer | ₦350                    | ₦150                              |

Both sides still snapshot onto the `ReferralRedemption` row at qualification, so
a later change to either the campaign's rate or the programme's referee reward
cannot alter what somebody has already earned.

At the ruled 100:1 these are 15,000 / 20,000 / 35,000 points. **The point
equivalents are computed from `loyalty_settings.points_per_naira`, never
hardcoded** — increment 1 exists precisely so there is one canonical rate.

For a points-denominated reward, `ReferralRedemption` needs two more columns so
the reward is auditable in both currencies without re-deriving it later:

```
  referrerRewardPoints  Int?
  pointsPerNairaAtGrant Int?   // the rate in force when it qualified
```

Snapshotting the rate is not optional. Without it, a later repricing would make
a paid points reward report a different naira cost than it actually had — the
exact failure increment 1's wallet-metadata snapshot already prevents for
redemptions.

**Financial isolation:** a points reward must be issued through the DX Points
ledger (`LoyaltyLedgerEntry`, type `BONUS` — "given rather than earned… the cost
of promoting it", `:4154`), never as wallet cash. A cash reward goes through
`walletService.credit()` exactly as today.

## 5. Customer acquisition benefit — universal, 20% off the first 3 rides

**Founder ruling (final): the 20% is a universal new-customer acquisition
incentive, not a pioneer-driver benefit.** Every customer acquired through any
eligible referral gets it identically — customer, rider, driver, pioneer driver,
influencer, creator, ambassador. The referral _source_ decides only the
promoter's reward (₦150 / ₦200 / ₦350 / configured). There is **one** mechanism,
attached to the customer's acquisition, and no per-class variant.

Eligibility is **separate from the promoter reward lifecycle**, per the ruling.
It does not wait for QUALIFIED or APPROVED: it attaches to the acquisition
attribution itself. That is a deliberate trade the founder has taken with the
exposure in finding (b) below on the record.

**Mechanism — `perUserLimit: 3` is wrong and is not used.** It counts
`PromotionRedemption` rows (claims), which the ruling rejects. Promotions are
redeemed at _ride-request_ time (`rides.service.ts:206-277`), so when ride N is
priced the customer has exactly N-1 completed rides:

```
acquisition attribution exists for this customer
  AND count(rides WHERE customerId = X AND status = COMPLETED) < 3
```

Ride #1 sees 0, #2 sees 1, #3 sees 2, #4 sees 3 and stops. Declining the discount
does not help — the ride still completes and still counts. The rides table is the
counter, and no campaign activity can reset it.

### This needs no schema change

`Promotion.rules` is a JSON column with a validated shape
(`PromotionRulesDto`, `promotion-rules.ts`). The benefit is one **platform-wide**
`Promotion` row — `type: PERCENTAGE`, `domains: [RIDE]`, `percentOff: 20` — whose
eligibility is expressed as rules, not as new tables or columns. One row, because
the incentive is universal: a per-campaign row would let campaigns diverge, which
the ruling forbids.

### Finding (d): four existing rules are dead in production

`PromotionRulesDto` already declares `newUsersOnly`, `returningUsersOnly`,
`referralOnly` and `inviteOnly`, and the evaluator implements all four
(`promotion-rules.ts:204-214`) against `context.isNewUser` / `isReferral` /
`isInvited`.

**No production caller populates any of those three context fields.** A grep
across `apps/backend/src` for `isReferral|isNewUser|isInvited`, excluding
`promotion-rules.ts` itself, returns nothing. The ride path passes only
`eligibility: { rideType }` (`rides.service.ts:340-344`).

So today an operator can configure a `newUsersOnly` campaign in Ops and it will
silently refuse **everyone**, because `context.isNewUser !== true` always holds.
`referralOnly` is the same. The unit tests pass
(`promotion-rules.spec.ts:77-94`) because they hand the evaluator a context
directly — the rule is correct and unreachable, which is precisely the
"mapped is not reachable" class CLAUDE.md §5 records.

This is pre-existing and not caused by this work, but it is load-bearing for the
benefit: populating the eligibility context is a prerequisite, not an optional
extra. Fixing it is therefore in scope; a regression test must drive it through
the real ride path rather than through a hand-built context.

### Findings (a)-(c), retained

**(a) The benefit cannot wait for qualification if ride #1 is to be discounted.**
Customer qualification needs `ride.count({ status: COMPLETED }) >= 1`
(`referral-qualification.service.ts:100-107`); at the moment ride #1 is priced
that count is 0. The ruling resolves this by separating the discount from the
reward lifecycle — the discount keys off the attribution, which exists from
signup.

**(b) The discount is real platform money, spent before anti-abuse clears.**
`ride-payment.service.ts:654` — "DrippleX funds its own promotion" — and the
clawback path covers refunds (`:862`), not a referral later REJECTED. Up to three
discounted rides may therefore be funded for an acquisition that screening later
rejects. Accepted by the founder; recorded because nothing in the code recovers
it.

**(c) Qualification does not require a ride.** The customer milestone accepts a
completed marketplace order equally (`:98-109`), so a promoter can be paid for a
customer who has never ridden; that customer's three-ride benefit then waits for
their first ride whenever it happens.

## 6. Qualification — unchanged

Nothing in this contract touches the qualification path. Verified as it stands:

- `PENDING → QUALIFIED → APPROVED → PAID`, `REJECTED` and `REVERSED`
  (`referral-lifecycle.service.ts:82`).
- Customer milestone is the **first completed ride**:
  `referral-qualification.service.ts:100` counts
  `ride.count({ customerId: refereeUserId, status: RideStatus.COMPLETED })`.
- Hold before payment, qualification window, and `requireKycVerified` stay
  `ReferralProgramme` settings (`schema.prisma:4713` holdDays, `:4727`
  requireKycVerified).
- Anti-abuse screening (`referral-anti-abuse.service.ts`) and
  `ReferralFraudCheck` stay in the path.
- `refereeUserId` is unique platform-wide (`:4752`), so one person can be
  acquired once, ever. That is what stops a promoter re-acquiring the same
  customer across campaigns — and it is already enforced by the database rather
  than by application logic.

## 7. Financial isolation

Referral rewards do not enter ride settlement. They are wallet credits with
their own reference types (`REFERRAL_WALLET_REFERENCE_TYPES`), or DX Points
ledger entries, and they are raised by the referral lifecycle rather than by any
settlement path. The campaign's `budgetSpent` tracks the _discount_ it funded;
promoter payouts are counted from `ReferralRedemption`, not folded into it —
mixing them would make a campaign's budget mean two different things.

Full trace, answerable from the rows:
`Promotion` → `CampaignPromoter` (token, participant type) → `ReferralRedemption`
(`campaignPromoterId`, `refereeUserId`) → qualification (`qualifiedAt`, fraud
checks) → reward (snapshotted amount/points, `paidAt`, wallet or points ledger
entry).

## 8. Ops Promotions tab

Reads from the above; no new storage. Campaign list and CRUD from `Promotion`;
promoter add/remove and reward config from `CampaignPromoter`; referrals,
qualified, pending and earned from `ReferralRedemption` grouped by
`campaignPromoterId`; conversion rate and CPA computed, with points converted at
`pointsPerNairaAtGrant` so cash and points campaigns are comparable.

The console already has `/referrals`, `/referrals/review` and
`/referrals/programmes`. Promotions is a new tab, not a replacement for those.

---

## The one ruling still needed

**When does the 20% benefit start?** Per finding (a), the ruling's "after
qualifying" and "Ride #1 receives the benefit" cannot both be satisfied:
qualification cannot have happened when ride #1 is priced.

- **Option A — grant on the pending acquisition.** Rides #1-#3 are discounted.
  Matches "Ride #1, #2, #3 receive the benefit" exactly. Cost: finding (b) —
  up to three discounts funded before anti-abuse clears, unrecoverable if the
  referral is later rejected.
- **Option B — grant from the first ride after qualification.** No money is
  spent before screening. Cost: the qualifying ride is not discounted, so the
  customer's first three _discounted_ rides are their 2nd, 3rd and 4th.

This is a business trade-off between honouring the advertised offer on ride #1
and not funding discounts for referrals that may be fraudulent. It is not an
implementation detail and is not being guessed.

## Decisions now locked (founder ruling, 2026-09-12)

1. **Token generation** — `CampaignPromoter.token` is the private campaign
   attribution token: cryptographically generated, database-unique, normalised,
   and kept separate from `referrals.code` and `promotions.code`. Resolution uses
   the campaign-promoter namespace explicitly. An ambiguous string across legacy
   namespaces is **rejected, never guessed**.
2. **First three rides** — first three _completed rides ever_, one platform-wide
   acquisition benefit, no restart and no stacking. Mechanism per §5.
3. **Referee reward** — fixed platform-wide at ₦150 via `ReferralProgramme`, not
   per-campaign configurable. Promoter side varies by participant class
   (₦150 / ₦200 / ₦350) on `CampaignPromoter`. Both snapshot at qualification.
4. **Multiple campaigns** — a promoter may participate in several at once, each
   with its own token. A referred customer qualifies **once platform-wide**; the
   first valid attribution wins and later attempts create neither a second reward
   nor a fresh three-ride benefit. `ReferralRedemption.refereeUserId @unique`
   (`:4752`) already enforces this at the database level.

No migration, no service and no UI has been written. Nothing in this document is
implemented yet.

---

# Migration / schema plan

Not written and not applied. Listed so the shape can be checked against the
existing constraints before any SQL exists.

## What needs no migration at all

The **20% acquisition benefit** (§5). `Promotion.rules` is JSON, so the new
eligibility predicate is a field on `PromotionRulesDto` plus context the ride
path already had a slot for. One seeded platform-wide `Promotion` row. No table,
no column, no enum.

That leaves the promoter side as the only schema work.

## Migration 1 — enum additions (additive, no data change)

```
enum CampaignParticipantType {
  CUSTOMER  RIDER  DRIVER  PIONEER_DRIVER  INFLUENCER  CREATOR  AMBASSADOR
}
enum CampaignPromoterStatus { ACTIVE  REMOVED }
```

`ReferralOwnerType` is **not** extended. Per §2 it decides which wallet a reward
is paid into, and every participant class above already maps onto an existing
owner type. Adding members to it would break `REFERRER_WALLETS[ownerType]`
(`referral-lifecycle.service.ts:373`), which is an exhaustive map.

## Migration 2 — `campaign_promoters`

New table per §2. Constraints traced against what exists:

| Constraint                        | Reason                                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------------- |
| `@@unique([promotionId, userId])` | One participation per campaign per user; permits the same user in several campaigns (ruling 4)     |
| `token @unique`                   | Database-level guarantee; §3's namespaced resolution sits on top                                   |
| FK `promotionId → promotions.id`  | `onDelete: Restrict` — a campaign with promoters must not vanish under its own attribution history |
| FK `userId → users.id`            | `onDelete: Cascade`, matching `Referral.userId` and `DriverReferral.driverId`                      |
| `@@index([token])`                | Lookup path                                                                                        |

`onDelete: Restrict` on `promotionId` is a deliberate divergence from
`DriverReferral`, which cascades from `ReferralCampaign` (`schema.prisma:4895`).
Cascading is right for a monthly driver campaign whose rows are derived; it is
wrong here, because deleting a campaign would delete the promoter rows that paid
reward history points at. Ruling 4 requires the attribution to survive.

## Migration 3 — `referral_redemptions` additions

All nullable, so every existing row stays valid and no backfill runs:

```
campaignPromoterId    String?  @map("campaign_promoter_id") @db.Uuid
referrerRewardPoints  Int?     @map("referrer_reward_points")
pointsPerNairaAtGrant Int?     @map("points_per_naira_at_grant")
```

Same precedent as `programmeId`, which is nullable "for every row that predates
programmes" (`:4760-4762`). FK `campaignPromoterId → campaign_promoters.id`
with `onDelete: Restrict`, for the reason above.

**No change to `refereeUserId @unique`** (`:4752`). It already enforces ruling
4's once-ever acquisition at the database level, and widening it to
`[refereeUserId, campaignPromoterId]` would be the bug that allows campaign
stacking. Stated explicitly because it is the tempting edit.

## Ordering and reversibility

1. Enums first (nothing references them yet).
2. `campaign_promoters` second (references `promotions`, `users`).
3. `referral_redemptions` columns last (references `campaign_promoters`).

Every step is additive. No column is dropped, no type narrowed, no row rewritten,
so a rollback is a `DROP` of what was added rather than a restore.

## Still to trace before writing the SQL

- Whether `promotions` has any trigger or view that a `Restrict` FK would
  interact with.
- Whether the referral sweep's queries need an index on
  `referral_redemptions.campaign_promoter_id` for the Ops dashboard's
  group-by-promoter reads.
- The exact `REFERRER_WALLETS` mapping for each participant class, so that an
  influencer's reward lands somewhere that exists.
