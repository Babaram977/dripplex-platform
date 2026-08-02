# Driver Growth Campaign

Founder decision (2026-08-02): a production-ready monthly driver-referral
campaign, built into the existing Referral module (`apps/backend/src/referrals/`)
rather than as a separate top-level module — reusing its wallet-crediting,
notification, and code-generation infrastructure instead of duplicating it.

This sits alongside, but is architecturally distinct from, RIDE-004.1's
generic customer-to-customer Referral system built earlier the same day:
that system is "any customer refers any customer, rewarded on the referee's
first ride." This one is "a driver refers passengers, rewarded on a monthly
tiered quota with a quality gate." They share a registration entry point
(one `referralCode` field) and a code-uniqueness namespace, but have
separate schema, separate reward logic, and don't otherwise interact.

## Schema

Six new models, all in `schema.prisma`, migration
`prisma/migrations/20260802030000_add_driver_referral_campaigns/`:

- **ReferralCampaign** — one row per calendar month. Carries the
  thresholds/rewards/rate as editable fields (not hardcoded), so admin's
  "change reward amounts" requirement is a real column update, not a
  redeploy.
- **DriverReferral** — one row per driver per campaign, holding their
  unique code for that month.
- **ReferralStatistics** — the live rollup (invites/registered/qualified/
  completed-trips/current-tier) for one DriverReferral, updated
  incrementally in the same transaction as each underlying event. A
  dashboard read is a single row fetch, never an aggregate query.
- **PassengerReferral** — one row per referred passenger.
  `refereeUserId` is globally unique (a passenger can only ever be
  attributed to one driver, one campaign).
- **ReferralReward** — one row per driver per campaign (unique constraint
  on `campaignId, driverId`). This is a schema-level guarantee of "only
  one reward tier is paid per campaign," not just an application check.
- **ReferralFraudCheck** — an audit trail of automated + manual fraud
  review, linked to a PassengerReferral or DriverReferral.

## Reward status is one field, not two

The brief asked to track both "reward status" and "payment status."
`ReferralReward.status` is a single `PENDING → APPROVED → PAID` (or
`REJECTED`) enum instead of two parallel fields, because every state
unambiguously encodes both: `APPROVED` always means "not yet paid,"
`PAID` always means "was approved." Splitting it into two columns would
let them go out of sync (e.g. `PAID` + `status: PENDING`) for no benefit.

## Reward computation: live estimate, gated finalization

`DriverCampaignService.recomputeTier()` runs every time a passenger
qualifies (5th completed paid trip) — it's a pure function of
`qualifiedCount`/`registeredCount` against the campaign's thresholds:

```
GOLD  if qualifiedCount >= goldThreshold AND qualifiedCount / registeredCount >= goldQualificationRate
SILVER if qualifiedCount >= silverThreshold
NONE  otherwise
```

The Gold rate check uses **registeredCount** (everyone who signed up with
the code) as the denominator, not just qualified passengers — reading the
brief's "at least 75% of the referred passengers must complete the
required 5 trips" literally. This is a deliberate anti-gaming gate: a
driver who spams their code to 1,000 people and gets 100 to qualify
(10% rate) does **not** hit Gold even though the raw headcount clears
100 — only Silver, since the quality bar wasn't met. Without this,
"100 referred" would be gameable by volume alone.

`ReferralReward` is upserted (not just recomputed) on every tier change
during the campaign so the dashboard's "Estimated Reward" is always live —
but the `status` stays `PENDING`, and **admin approval/rejection is only
allowed once the campaign has `ENDED`** (`requireReviewableReward` checks
the campaign's status via its relation, not just the reward's own
status). This exists because tier can still improve mid-month (e.g.
Silver → Gold), and approving a reward before the month closes risks
having to claw back a smaller approved amount. The one-row-per-driver
constraint means an upgrade never creates a second reward — it updates
the existing PENDING row in place.

## Reward trigger: first 5 paid trips, not signup

Same fraud reasoning as RIDE-004.1's customer referral system. A
passenger only counts toward `qualifiedCount` after completing 5 rides
whose payment succeeded (`DOMAIN_EVENTS.RIDE_PAYMENT_SUCCEEDED` — payment
only ever succeeds on a `Ride` already in `COMPLETED` status, per
`RidePaymentService`, so this event alone is "a successful paid trip";
cancelled rides never reach it, satisfying "cancelled rides do not
count" with no extra logic). Trip counting stops incrementing once a
campaign's `periodEnd` has passed, even if a stray webhook or retried
payment arrives late — no late-month trips can inflate the following
month's numbers.

## Fraud checks: what's real, what isn't

`ReferralFraudCheckType` has three values: `SELF_REFERRAL`,
`DUPLICATE_REFEREE`, `MANUAL_FLAG`. Being explicit about what each one
actually is:

- **SELF_REFERRAL** — checked and enforced (`driverReferral.driverId ===
refereeUserId`). In practice this is structurally close to
  unreachable through the normal registration flow, because email/phone
  uniqueness on `users` already prevents a driver from registering a
  second "customer" account with the same identity — but the check is
  cheap, correct, and defends against any future entry point that
  doesn't share that constraint.
- **DUPLICATE_REFEREE** — checked via a `PassengerReferral.findUnique`
  pre-check before insert, in addition to the DB's own unique constraint
  on `refereeUserId`. Real, but — like self-referral — only reachable
  today if a second entry point to redemption is ever added.
- **MANUAL_FLAG** — not automatically produced by anything. It's the
  admin's tool (`POST /admin/referral-campaigns/fraud-checks/:id/review`)
  for recording a judgment call — a suspicious pattern a human noticed
  that no mechanical rule here catches (device fingerprinting, IP
  correlation, and velocity limits do not exist in this codebase). This
  is intentionally not oversold as automated fraud detection.

## Wallet crediting

Reward payment goes through the same `WalletService.credit()` +
`referenceType`/`referenceId` idempotency pattern used everywhere else
this session (`RIDE_WALLET_REFERENCE_TYPES`,
`REFERRAL_WALLET_REFERENCE_TYPES`) — here,
`DRIVER_CAMPAIGN_WALLET_REFERENCE_TYPE = 'driver_referral_campaign_reward'`
paired with `referenceId = reward.id`. Paying the same reward twice is a
no-op at the ledger level, not just an application-level guard.

## Notifications

Six new domain events, one per requested trigger, all routed through the
existing `NotificationCenterSubscriber` (no parallel system):

| Event                                  | Category | Audience |
| -------------------------------------- | -------- | -------- |
| `DRIVER_REFERRAL_PASSENGER_REGISTERED` | RIDE     | driver   |
| `DRIVER_REFERRAL_PASSENGER_QUALIFIED`  | RIDE     | driver   |
| `DRIVER_REFERRAL_TIER_SILVER_REACHED`  | RIDE     | driver   |
| `DRIVER_REFERRAL_TIER_GOLD_REACHED`    | RIDE     | driver   |
| `DRIVER_REFERRAL_REWARD_APPROVED`      | WALLET   | driver   |
| `DRIVER_REFERRAL_REWARD_PAID`          | WALLET   | driver   |

RIDE was chosen for the four progress events (this is squarely
ride/driver-ecosystem activity); WALLET for the two money events. No new
`NotificationCategory` value was added — both existing categories already
fit without stretching. Tier-reached events only fire once per campaign
(guarded by comparing `previousTier` to `newTier` before emitting).

## Campaign lifecycle

`DriverCampaignSweepService` — a plain `setInterval` (every 5 minutes),
mirroring `RideOfferSweepService`'s existing pattern (no
`@nestjs/schedule` dependency in this codebase) — handles the two
time-driven transitions:

- `DRAFT → ACTIVE` once `periodStart` arrives.
- `ACTIVE`/`PAUSED → ENDED` once `periodEnd` passes.

Pause/resume stay explicit admin actions (`POST .../pause`,
`POST .../resume`), not sweep-driven.

## Endpoints

**Driver** (`driver:referral_campaign:use`):

- `GET /driver/referral-campaign/code` — get or lazily create my code for
  the active campaign.
- `POST /driver/referral-campaign/invite` — record a share-button tap
  (the only honest source for "Total Invites" — there's no real
  invite-delivery mechanism to count against, so this counts taps, not
  guaranteed sends).
- `GET /driver/referral-campaign/dashboard` — code, live stats, progress
  to Silver/Gold, estimated reward, countdown, reward history.

**Admin** (`admin:referral_campaigns:manage`), all under
`/admin/referral-campaigns`:

- `POST /`, `GET /` — create/list campaigns.
- `PATCH /:id/rewards` — change thresholds/reward amounts (blocked once
  `ENDED`).
- `POST /:id/pause`, `POST /:id/resume`.
- `GET /:id/leaderboard` — drivers ranked by qualified count.
- `GET /:id/export` — CSV report (no existing export precedent in this
  codebase to follow, so this is a minimal `text/csv` streamed response,
  not a new file-storage pipeline).
- `GET /rewards`, `POST /rewards/:id/approve`, `/reject`, `/pay`.
- `GET /fraud-checks`, `POST /fraud-checks/:id/review`.

## Explicitly out of scope this pass

- **driver-portal / admin-portal UI.** This delivery is backend + SDK
  only, matching how DPX-CORE-001 Phase 1 and RIDE-004.1 were also
  backend-only. The brief's "Dashboard" and "Admin" sections describe
  what the API now supports, not screens built in this pass — flagging
  this explicitly rather than silently skipping it, since the founder's
  message did describe UI-visible data.
- Device fingerprinting / IP-based fraud detection (see Fraud checks
  above).
- Reward amount defaults (₦40,000 Silver / ₦100,000 Gold) match the
  brief exactly, so unlike RIDE-004.1's placeholder amounts, these don't
  need separate founder confirmation — they're already the specified
  numbers, just stored as editable campaign fields rather than hardcoded.

## Verification

Backend: `tsc --noEmit` clean, `eslint --max-warnings=0` clean, `jest`
131/131 suites, 887/887 tests (includes 58 new tests across
`driver-campaign.service.spec.ts`, the trip subscriber, the sweep
service, and permissions). SDK: `tsc`, `eslint`, `vitest` (65/65) all
clean, including the new `DriverCampaignClient`/`AdminDriverCampaignClient`.
`packages/types` builds clean. customer-web: `tsc`, `eslint`,
`vitest` (4/4), `next build` (21/21 routes) all clean and unaffected
(this feature doesn't touch customer-facing code).
