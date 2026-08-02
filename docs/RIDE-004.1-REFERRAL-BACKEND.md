# RIDE-004.1 — Referral Backend

Founder-approved sequencing (2026-08-02): notification core (DPX-CORE-001
Phase 1) is complete; this is item 4 of the follow-up list — "Build Referral
backend" — before Promo (item 5) and Firebase (item 6).

## What this is

A referral system: any customer can get a shareable code, and a new
customer who signs up with that code creates a **pending** link between
referrer and referee. Both get a wallet reward once the referee completes
their **first ride** — not at signup.

## Schema

Two new models (`apps/backend/prisma/schema.prisma`):

- `Referral` — one row per user who has requested a code. `userId` unique,
  `code` unique (8-char, generated from an alphabet that excludes visually
  ambiguous characters: `0/O`, `1/I/L`).
- `ReferralRedemption` — one row per referee (`refereeUserId` unique — a
  user can only be referred once). `status`: `PENDING` → `REWARDED` (or
  `EXPIRED`, unused today, reserved for a future TTL policy).

No `User.referralCode` column, no repurposing `CustomerProfile` — a
dedicated model matches how `NotificationPreference`/`DeviceToken` were
added earlier this session, rather than growing `User`.

Migration: `prisma/migrations/20260802020000_add_referrals/` (hand-authored
SQL — this sandbox has no live Postgres to run `prisma migrate dev`
against; the same pattern used for every schema change this session).

## Reward trigger: first completed ride, not signup

This is the one deliberate design decision beyond what the founder
specified, so it's called out explicitly: a signup-only reward is a known
free-money fraud vector (create two accounts, refer one from the other,
collect the bonus with zero real usage). Gating the reward on the
referee's first **completed ride** means the reward only pays out once
real platform activity happened.

Implementation: `ReferralRewardSubscriber` listens for
`DOMAIN_EVENTS.RIDE_COMPLETED` (already emitted by `RideTripService`) and
calls `ReferralsService.handleRefereeRideCompleted(customerId)`, which:

1. Finds a `PENDING` redemption for that customer.
2. Confirms this is their first `COMPLETED` ride (`prisma.ride.count`).
3. Credits both wallets and flips the redemption to `REWARDED`.

This mirrors the existing `WalletEventsSubscriber` stub
(`src/wallet/wallet-events.subscriber.ts`) — decoupled from ride logic via
the domain event bus, not a direct call from `RideTripService`.

**Known limitation, accepted rather than engineered around:** if the
handler throws after crediting one wallet but before the other (or before
flipping the redemption to `REWARDED`), there is no automatic retry —
`RIDE_COMPLETED` fires once and is not redelivered. Each individual wallet
credit is idempotent (see below), so a manual re-trigger would be safe, but
there's no automated recovery path today. Flagging this rather than
building saga/compensation logic that the current event system doesn't
otherwise have.

## Wallet crediting: reused pattern, no new enum value

Neither `WalletOwnerType` nor `WalletTransactionType` has a `REFERRAL`
value. Rather than add one, this follows the exact pattern ride settlement
already uses: plain `WalletService.credit()` (transaction type `CREDIT`)
with a `referenceType` string + `referenceId` pair for idempotency —
`RIDE_WALLET_REFERENCE_TYPES` (`ride.constants.ts`) is the precedent;
`REFERRAL_WALLET_REFERENCE_TYPES` (`referral.constants.ts`) mirrors it:

```ts
REFERRAL_WALLET_REFERENCE_TYPES = {
  REFERRER_REWARD: 'referral_referrer_reward',
  REFEREE_REWARD: 'referral_referee_reward',
};
```

Both reward credits use `referenceId = redemption.id`, so `WalletService`'s
built-in idempotency (`WalletLedgerEntry` unique on
`walletId+referenceType+referenceId`) makes replaying the reward trigger
for the same redemption a no-op — safe against duplicate event delivery.

## Reward amounts — placeholder pending founder approval

```ts
REFERRAL_REWARD_AMOUNTS = { REFERRER: 500, REFEREE: 500 }; // NGN
```

Same discipline as `RIDE_PLATFORM_COMMISSION_RATE` in `ride.constants.ts`:
a number I do not have founder authority to invent for production, made a
single named constant so it's a one-line change once real amounts are
confirmed. Everything else (code generation, redemption tracking, reward
_trigger_) is real and doesn't depend on the amount.

**Open question for the founder:** confirm ₦500/₦500 (or a different
split — some referral programs are referrer-only, or scale with ride
value) before this goes to production.

## Redemption entry point: registration, not a separate endpoint

`PortalRegistrationDto` gained an optional `referralCode` field. In
`RegistrationService.registerPortal`, right after the user is created and
`CUSTOMER_REGISTERED` is emitted, if `portal === 'customer'` and a code
was supplied, `ReferralsService.tryRedeemAtRegistration()` is called
directly (injected via `@Optional()`, mirroring the existing `eventBus?`
pattern — so `RegistrationService`'s existing unit tests didn't need a
mock unless they're specifically testing this).

`tryRedeemAtRegistration` **never throws** — an invalid, unknown, expired,
or self-referral code is silently skipped (logged as a warning) rather
than failing the signup. A referral bonus is not a signup requirement.

Referral codes are customer-portal only for now (merchant/rider/driver
registration ignores the field even if sent) — the founder's Referral ask
was in a Ride/customer context.

## Notifications

Two new domain events (`domain-events.ts`):

- `REFERRAL_REDEEMED` — fired on successful redemption at registration;
  notifies the **referrer** ("Someone signed up using your referral
  code!"), category `MARKETING` (invite framing).
- `REFERRAL_REWARDED` — fired twice per reward (once for referrer, once
  for referee) with `{userId, amount, role}`; notifies whichever `userId`
  is in the payload ("You earned ₦{amount} from a referral"), category
  `WALLET` (money-credited framing, not marketing).

Both wired into `NotificationCenterSubscriber`'s existing mapping table —
no parallel notification path, consistent with DPX-CORE-001's
"consolidate, don't duplicate" rule. `amount` is emitted as a string
(`String(REFERRAL_REWARD_AMOUNTS.REFERRER)`), matching the existing
convention every other ride/payment event uses for currency amounts in
domain event payloads (see `RideTripService.notifyAndPublish`).

No dedicated `REFERRAL` value was added to `NotificationCategory` —
`MARKETING`/`WALLET` already fit both events without stretching either.

## Endpoints

- `GET /customer/referrals/me` — get (or lazily create) my referral code.
- `GET /customer/referrals/stats` — my code + redemption counts by status.
- `GET /admin/referrals/redemptions?status=&page=&pageSize=` — paginated
  redemption list for support/ops visibility.

Permissions: `customer:referrals:use`, `admin:referrals:manage` — seeded
in both `permissions.ts` and `role-permissions.ts` (the two-file
requirement the seed script enforces), granted to `customer` and to all
three admin-tier roles respectively.

## Not built here (explicitly out of scope)

- Any customer-web UI (referral code display, share sheet, code-entry
  field on the registration form). This is backend-only, matching how
  DPX-CORE-001 Phase 1 was backend-only.
- Anti-fraud beyond self-referral prevention and the first-ride gate (e.g.
  device fingerprinting, velocity limits). Flagged, not built — the
  founder can decide if/when it's warranted.
- Referral code expiry (`ReferralRedemptionStatus.EXPIRED` exists in the
  schema but nothing sets it).

## Next

RIDE-004.2 (Promo backend for ride fares) — per the founder's ordering,
immediately after this. Needs its own reality-audit pass on the existing
`promotions` module before deciding whether to extend it or build
something new.
