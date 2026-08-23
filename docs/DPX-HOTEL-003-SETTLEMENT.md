# DPX-HOTEL-003 — Paying the hotels

**Founder decision, 2026-08-22:** _"hotel settlements should be weekly every monday."_

## Why this had to exist

Decision 11 (DPX-HOTEL-002 §0.4) moved booking payment **through DrippleX** rather
than to the hotel's own bank account. That closed a trust problem — the gateway
says whether the money arrived, so nobody judges a screenshot — and opened a
different one in the same stroke: **DrippleX now holds money that belongs to
hotels.**

Without settlement, paid bookings would accumulate indefinitely and no hotel would
ever see a naira. This is not an enhancement to the booking flow; it is the other
half of it.

## What it does

Every Monday, for each hotel with bookings paid during the seven days that just
finished:

```
gross (what guests paid)  −  commission (DrippleX's cut)  =  net → hotel's wallet
```

The money lands in the hotel's existing DrippleX merchant wallet — the same place
every other merchant payout lands, drained by the same bank-withdrawal flow that
already exists. **No new money rail was built.**

### The week

A run on Monday the 24th settles Monday the 17th through Sunday the 23rd. A hotel
is paid for a week that has **finished**, never one in progress.

Everything is UTC, for the same reason the booking calendar is: Lagos is UTC+1, so
a local-midnight boundary would push Sunday's late bookings into the wrong week and
a hotel reconciling the figure against its own book would find it short by exactly
those.

The period end is **exclusive** — Sunday 23:59:59 is in, Monday 00:00:00 is next
week's business. An inclusive end puts that instant in both weeks or neither,
depending on how the comparison happened to get written.

### The clock

A plain `setInterval` ticking **hourly** and asking "is today Monday?", matching
`RideOfferSweepService` and the booking expiry sweep. This codebase has no
`@nestjs/schedule` and a weekly payout is not the place to introduce one.

Hourly rather than weekly because a once-a-week timer is lost to every restart and
every deploy. An hourly check costs nothing on the other six days.

## Paying a hotel twice — the failure this is built around

A weekly job **will** fire more than once on the same Monday: a restart, a
redeploy overlapping the old instance, two containers, an operator retrying.
Application code cannot make that safe on its own, because two runs both read
"not settled yet" and both decide to pay.

### What actually prevents it

`Booking.settlementId`, claimed by an update whose `WHERE` requires it to still be
null:

```ts
await this.prisma.booking.updateMany({
  where: { businessId, status: CONFIRMED, settlementId: null, paidAt: {…} },
  data:  { settlementId: settlement.id },
});
```

Postgres re-evaluates that condition after taking the row lock, so of two runs
racing for the same booking the loser matches **zero rows**, sums zero, and credits
nothing. A booking already carrying a settlement id is never picked up again — by
this week's run or any later one.

### What does _not_ prevent it, despite looking like it does

The unique index on `(businessId, weekStarting)`.

This was the original claim in the code comments, and it was wrong. It was tested
by **dropping the index and running four concurrent settlements anyway** — the
hotel was still paid exactly once, three times in a row. The sequential
"run it twice" test also passes without the index, because the second run's
group-by finds nothing unclaimed and never reaches the insert at all.

The index still earns its place, for two smaller reasons: it makes "one settlement
row per hotel per week" a fact of the schema rather than a convention, and it lets
a redundant run bail out immediately instead of doing work it will discard.

**Why this distinction is worth writing down:** a future change that keeps the index
while loosening the booking claim would look safe and would not be. The comments in
`booking-settlement.service.ts`, `schema.prisma` and the migration all now say which
guard is load-bearing.

## A failed payout is left alone

If the wallet credit throws, the settlement is marked `FAILED` with the reason, the
bookings **stay claimed**, and nothing retries automatically. Ops sees it at
`GET /admin/bookings/settlements?status=FAILED`.

Silently retrying a payout is how a hotel gets paid twice. A person looks at it.

## Endpoints

| Route                                | Who       | Why                                                                                                                                                                       |
| ------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /merchant/bookings/settlements` | the hotel | "What is this ₦54,000 for?" — the first question anyone asks about a payout. Scoped to the signed-in merchant; there is nowhere in the request to put another hotel's id. |
| `GET /admin/bookings/settlements`    | Ops       | Finding the `FAILED` rows that are waiting on a human.                                                                                                                    |

Both reuse the existing `merchant:bookings:manage` / `admin:bookings:manage`
permissions — **no new permission was added**, so there is no RBAC catalogue to
keep in sync (the failure mode that broke #226).

Neither side gets a "run settlement now" button. Ops re-running a payout by hand is
the double-payment scenario with a human driving, and it is not a founder decision.
`settleWeek(now)` exists on the service for a missed week, but it is not reachable
over HTTP.

The DTO sends `weekFrom`/`weekTo` alongside `weekStarting` so a hotel does not have
to know the settlement calendar to work out which nights the money covers.
`weekTo` is the **Sunday**, not the following Monday — a hotel reading "to: Monday"
would reasonably assume Monday was included.

## Verification

- 20 settlement tests against real Postgres (11 service + 9 week arithmetic),
  including the four-way concurrent race.
- Full backend suite: **226 suites, 1942 tests**, all passing. Not the bookings
  subset — the subset was green for #230 while `BookingsModule` was missing
  `PaymentsModule` and 37 tests in other suites were failing.
- The migration was replayed from scratch into a fresh database, and
  `prisma migrate diff` confirms it produces **exactly** what `schema.prisma`
  describes — zero drift attributable to these objects.

### Noted, not fixed

`prisma migrate diff` reports **23 pre-existing drift statements** between the
migration history and `schema.prisma` that predate this work — mostly inline
`REFERENCES` clauses that mean `ON UPDATE NO ACTION` where the schema says
`ON UPDATE CASCADE`, plus two index renames. None of them are in this change and
none are touched by it. Worth its own pass; folding it into a settlement PR would
mix unrelated risk into a money path.

## Looking before Monday

`GET /admin/bookings/settlements/preview` (Ops) and
`GET /merchant/bookings/settlements/next` (the hotel's own line) answer "what
will the next run pay" without paying it. Added 2026-08-23, the day before the
first live run.

Two things make it trustworthy rather than decorative:

- **It shares the run's query.** `owedForPeriod` is called by both the preview
  and `settleWeek`. A preview with its own copy of that query would agree with
  the run right up until somebody edited one of them, and then quietly show a
  hotel a number it is not going to be paid. A test previews, then settles, and
  asserts the four figures match.
- **It is dated from the next run, not from now.** Asked on a Sunday,
  "the period a run happening now would cover" is last week — already paid.
  `nextSettlementDay` walks forward to the run instead of backward from it.

Read-only by construction: it queries and stops. A test calls it three times
and asserts no settlement row exists, no booking is claimed, and no balance
moved.

Still no way to trigger a run by hand, in Ops or anywhere else. Re-running a
payout manually is how a hotel gets paid twice.

## Open

- **Nothing tells a hotel the money arrived.** The wallet credit happens and the
  settlement is queryable, but no notification is sent. `UtilityCustomerNotifier`
  is the pattern to copy. Not built here because the founder has not said what a
  hotel should be told or through which channel.
- **No settlement statement or export.** A hotel reconciling a quarter has to page
  through the list endpoint.
- `walletLedgerEntryId` is on the model and currently always null — the wallet
  service does not return the entry id from `settlement()`. Harmless, but it is a
  column promising a link it does not yet carry.
