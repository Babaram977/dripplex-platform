# DPX-OPS-002 — the Ops console can see money out, and where it came from

**Status:** Shipped.
**Date:** 2026-09-11

---

## 1. Founder decision

> "Move to ops console both back and frontend. The referral system should be readable distinctively
> for each persona user — we will be able to track performance and generate payout based on the
> result, actual KPI performance for all users on DX. Settlements and payout request tab which we
> will see driver, rider, merchant and fleet owner sending request of payout, either commissions,
> rewards and receivables."

---

## 2. Settlements & payout requests

### The problem

Every earning persona could already ask to be paid. None of them could be seen together.

| Persona                 | Where the request lives                          | Where Operations reviewed it |
| ----------------------- | ------------------------------------------------ | ---------------------------- |
| Driver, rider, customer | `withdrawal_requests` → `customer_bank_accounts` | `/admin/wallet/withdrawals`  |
| Merchant                | `withdrawal_requests` → `bank_accounts`          | `/admin/wallet/withdrawals`  |
| Fleet owner             | `fleet_settlement_requests`                      | `/admin/fleet-settlements`   |

An operator had to know which persona they were dealing with before they could find out who was
waiting. "How much do we owe partners right now?" had no answer short of adding up two screens.

### What shipped

`GET /operations/finance/payout-requests` reads both sources, normalises them and says where each is
actioned. Filter by persona and by status; `…/summary` gives the outstanding total broken down by who
is waiting for it.

**It deliberately does not approve anything.** The two kinds have genuinely different rules — a
withdrawal has _already debited_ the wallet at request time, while a fleet receivable has never been
paid into one — and collapsing their approval paths into a single button would be a way to pay the
wrong thing. Every row carries the `actionPath` that actions it, so the console never has to know
the mapping.

### Two things worth knowing about the implementation

**A withdrawal's persona is not a column.** It comes from the wallet the request is drawn on. That
wallet is reached through `withdrawal_requests.wallet_id`, which carries **no foreign key**, so
Prisma has no relation to traverse and the persona cannot be filtered in SQL. The service resolves
the wallets of the rows it has already fetched — one extra query — rather than putting a constraint
on a hot table for the sake of a read-only view. _That missing foreign key is a real integrity gap
and is recorded here rather than fixed in passing; it wants its own change._

**Paging is over a bounded window.** The two sources are separate tables with no sane way to join
them, so up to 500 rows of each are merged and paged in memory. Bounded on purpose: a pile-up
degrades into "the oldest 500" rather than an unbounded read. If the pending queue ever outgrows
that, it wants a materialised view, not a bigger `take`.

---

## 3. Referral performance, per persona

### Why "distinctively for each persona" is the whole point

DrippleX runs **two referral programmes that look like one**:

- The generic `Referral` code, held by customers, drivers and riders. Its `ownerType` decides which
  wallet a reward is paid into, so the personas are already financially distinct.
- The **Driver Growth Campaign** — monthly, tiered, with its own approval queue and its own money
  (`ReferralCampaign` / `ReferralReward`).

Reported together they hide the question Operations is actually asking, which is _whose programme is
converting_. They are shown apart because they are apart.

**Conversion is rewarded-over-redeemed, not redeemed-over-issued.** A code that was redeemed but
never qualified has cost nothing and earned nobody anything. Counting it would make a programme look
like it is working when nobody has been paid — and the founder's ask was to "generate payout based
on the result", so the result has to be what qualified.

`rewardAmountEarned` is **null, not zero**, for personas with no reward programme. ₦0 earned claims
they took part and earned nothing; null says there is nothing to take part in.

### Merchants and fleet owners have no referral programme

Not "none configured yet" — there is no `ReferralOwnerType` for either, no code they can share, and
no decision about what either would earn for referring whom. The API names them in
`personasWithoutProgramme` and the console says so in words, because **a row of zeroes reads as
"nobody is referring" when the truth is "nobody can"**.

Building one would need founder decisions: what a merchant earns for referring a merchant (or a
customer), what a fleet owner earns for referring a fleet, and which wallet each is paid into.

---

## 4. What shipped

**Backend** — `OperationsPayoutsService`, `OperationsReferralsService`, and
`OperationsFinanceController` under `/operations/finance`, guarded by a new
`operations:finance:read`. Its own permission rather than reusing `operations:analytics:read`: that
is aggregate operating data, while this names individual partners, what they are owed and what they
have earned. Read-only, so an operator can be given the queue without being given the ability to pay
anybody.

**Ops console** — a new "Money" menu with three screens: Settlements & Payouts (new), Commission
(from DPX-COMMISSION-001), Referral Performance (new).

### Verification

- 259 suites / 2556 tests green against a **fresh, migrate-only, never-seeded Postgres** with
  `CI=true` — the exact conditions the workflow runs under, not a developer database with seeded
  roles lying around.
- `pnpm lint` 17/17, `pnpm typecheck` 18/18.
- 8 payout-queue tests (persona resolved from the wallet, per-persona filtering, status mapping
  across two different source enums, platform wallets excluded, the summary breakdown) and 6
  referral tests (persona separation, every persona reported even at zero, personas without a
  programme named rather than zeroed, conversion on rewarded, per-persona leaderboards, null reward
  money).

---

## 5. Open

### 5.1 `withdrawal_requests.wallet_id` has no foreign key

Found while building this. Every other reference on that table is constrained; this one is not, so
nothing stops a request pointing at a wallet that does not exist. The service treats an unresolvable
wallet as "not a partner waiting to be paid" rather than crashing, but the constraint is the actual
fix and belongs in its own change against a hot table.

### 5.2 "Generate payout based on the result"

The console now shows what each referrer actually earned. Turning a leaderboard row into a payout is
still manual — the Driver Growth Campaign has its own approve/pay queue, and the generic programme
credits wallets automatically on qualification. Whether Operations should be able to originate a
payout _from_ this screen is a decision, not an oversight: it would mean paying somebody outside the
programme that earned it.

### 5.3 KPI beyond referrals and payouts

The founder's phrase was "actual KPI performance for all users on DX". This covers referral
performance and money owed. Ride-side operating KPIs already exist in Operations Analytics (driver
utilisation, shifts, dispatch, response times, geographic demand). What is _not_ covered anywhere is
a per-merchant or per-rider performance view — which metrics would matter there has not been
specified.
