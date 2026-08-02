# Driver Growth Campaign — Driver Portal UI

Follows the backend/SDK delivery in `docs/DRIVER-GROWTH-CAMPAIGN.md`
(commit `b5158eb`), which explicitly flagged driver-portal UI as out of
scope for that pass. This delivery closes that gap: the complete Driver
Portal UI for the Driver Growth Campaign, built on the existing APIs and
SDK. No backend business logic changed except where noted below.

## `apps/driver-portal` didn't exist

The app directory held only a stub `package.json` — no `src/`, no Next.js
config, no SDK barrel. Building "the complete Driver Portal UI" required
scaffolding the app first, cloned from `apps/rider-portal`'s structure
(the newest, most current portal-app pattern in the monorepo): `next.config.ts`,
`tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, Tailwind config,
`AppProviders` root layout, the `useRequireAuth`/`PortalAuthGate` pattern,
and a login screen wired to `sdk.auth.loginDriver`.

**Deliberately omitted from the scaffold:** the Cloudflare Workers deploy
stack (wrangler, open-next, Sentry instrumentation, Dockerfile) that
rider-portal carries. "Production build clean" in the verification
checklist means `next build` succeeds — it doesn't imply a deployment
target has been chosen for this app yet. That infrastructure is a few
files to add later once a target is decided; adding it speculatively now
would be scope the founder didn't ask for.

## Closing three plumbing gaps (not business logic)

The 8-screen spec needed three things the backend didn't expose yet.
Each is pure routing/permission surface over an already-built service —
no service method was added, changed, or had its logic touched:

1. **Driver-scoped notifications.** `DriverNotificationsController` at
   `/driver/notifications` mirrors the existing
   `CustomerNotificationsController` (list/markRead/markAllRead/delete),
   reusing the same `NOTIFICATION_CENTER_PERMISSIONS.CUSTOMER_READ/MANAGE`
   permissions and the same `NotificationsCenterService`. This is the
   same multi-controller-per-service pattern already used for Wallet
   (customer/merchant/rider/driver/admin controllers over one
   `WalletService`) — driver notifications just hadn't gotten its
   controller yet. `NotificationsClient` in the SDK took a `basePath`
   constructor param so one class serves both `/customer/notifications`
   and `/driver/notifications` without duplicating request logic.

2. **Driver-facing leaderboard.** `GET /driver/referral-campaign/leaderboard`
   calls a new `DriverCampaignService.getLeaderboardForActiveCampaign()`,
   which is deliberately a **separate, narrower** DTO from the existing
   admin leaderboard: no referral `code` (a driver-facing leaderboard
   showing other drivers' codes would let a rival driver "steal" a code
   or pollute another driver's stats), masked names (`"First L."`), plus
   an `isCurrentDriver` flag so the UI can highlight your own row. This
   is new routing over the same underlying statistics query the admin
   leaderboard already uses, not new business logic.

3. **Driver wallet access via SDK.** `driverWallet()`/`driverTransactions()`
   were added to the SDK's `WalletClient`, pointing at the driver wallet
   controller endpoints that already existed on the backend (they just
   hadn't been exposed through the SDK yet, since no driver-portal existed
   to call them).

All three, plus the new `NotificationType` literals below, were verified
independently before any screen code was written: backend `tsc`/`eslint`
clean, `jest --runInBand` 131/131 suites and 892/892 tests, SDK
`tsc`/`eslint`/`vitest` 66/66, `packages/types` builds clean.

## One real defect found and fixed: missing `NotificationType` literals

`packages/types`' shared `NotificationType` union (the frontend-facing
type every portal app imports) was missing the six
`DRIVER_REFERRAL_*` values that the backend's Prisma enum and
`NotificationCenterSubscriber`'s event-mapping table already emit
(`DRIVER_REFERRAL_PASSENGER_REGISTERED`, `_PASSENGER_QUALIFIED`,
`_TIER_SILVER`, `_TIER_GOLD`, `_REWARD_APPROVED`, `_REWARD_PAID` — added
in the prior backend delivery). This is exactly the kind of "real defect"
the brief's "do not modify backend business logic unless a real defect is
discovered" carve-out describes: without it, the Referral Activity Timeline
screen has no type-safe way to filter for these six notifications, and any
frontend importing `@dripplex/types` silently can't represent notifications
the backend already sends. Fixed by adding the six literals to the
`NotificationType` union and their sound-event mappings in
`NOTIFICATION_SOUND_EVENTS` (required since that map is
`Record<NotificationType, ...>` and fails to typecheck otherwise). No
backend file changed.

## The 8 screens

All under `apps/driver-portal/src/app/`, sharing one `AppShell` nav
(`/`, `/rewards`, `/activity`, `/leaderboard`, `/wallet`, `/learn`):

1. **Referral Dashboard** (`/`, `ReferralCodeCard`) — code, QR code
   (`qrcode.react`, new dependency), copy-to-clipboard, and share buttons
   for WhatsApp/SMS/Facebook/X/Telegram plus the native Web Share API
   where available. Every share tap calls `recordInvite()` so the
   dashboard's invite count reflects real share activity, not just page
   views.
2. **Campaign Progress** (`/`, `CampaignProgressCard`) — days remaining
   (`campaignCountdownSeconds`), invited/registered/qualified/completed-trip
   counts, animated Silver/Gold progress bars (new `@dripplex/ui`
   `Progress` primitive, dependency-free, added to the shared package
   rather than pulling in Radix's progress package for one bar), the
   live qualification-rate readout against the campaign's actual
   `goldQualificationRate`, current tier, and estimated reward.
3. **Reward History** (`/rewards`) — every `DriverReferralRewardDto` from
   `dashboard.rewardHistory`, with status badge, approval/payment dates,
   and a client-generated plain-text receipt download (no backend PDF
   pipeline exists, so this is an honest text summary, not a fabricated
   PDF).
4. **Referral Activity** (`/activity`) — a timeline built from the six
   `DRIVER_REFERRAL_*` notification types via the polling
   `useNotifications` hook. `NotificationListQuery.type` only accepts one
   type, so the screen fetches one wide page (`limit: 50`) and filters
   client-side rather than issuing six requests.
5. **Leaderboard** (`/leaderboard`) — `useDriverLeaderboard`, privacy-scoped
   as described above, current driver's row highlighted.
6. **Driver Education** (`/learn`) — static rules/FAQ content, but pulls
   the actual thresholds (trip count, tier thresholds, reward amounts,
   qualification rate) from the live campaign dashboard where one is
   active, falling back to the schema defaults (5 trips, 50/₦40,000
   Silver, 100/75%/₦100,000 Gold) otherwise — so the copy can't drift
   from whatever an admin has configured for the current campaign.
7. **Notification integration** — the existing `NotificationBell`
   (60-second polling, per DPX-CORE-001's established pattern — no
   WebSocket layer exists or was added) ported to driver-portal, plus the
   Activity timeline above, both reading from the new
   `/driver/notifications` routes.
8. **Wallet Integration** (`/wallet`) — balance
   (`available`/`pending`) and transaction history via
   `useDriverWallet`/`useDriverWalletTransactions`, with ledger entries
   whose `referenceType` matches the backend's
   `DRIVER_CAMPAIGN_WALLET_REFERENCE_TYPE` constant
   (`'driver_referral_campaign_reward'`) badged as "Referral campaign" so
   a driver can see which wallet credits came from the program.

## No fabricated deep link

Every share channel (WhatsApp, SMS, Facebook, X, Telegram, native share)
carries the driver's code as **text**, never a pre-filled
`/register?ref=CODE`-style URL — no such route exists anywhere in the
platform today; customer-web's registration form takes a manually-typed
`referralCode` field, it doesn't read one from the URL. `share.ts`
includes a customer-app homepage link only because Facebook's and
Telegram's share intents require a `url` param to render at all, not
because it's a referral-specific landing page. Documented in
`apps/driver-portal/src/lib/share.ts`'s file-level comment so a future
change doesn't accidentally invent a link the backend can't honor.

## Design system

No new colors or components were invented. `@dripplex/ui`'s existing
Card/Badge/Button/Skeleton/EmptyState/DropdownMenu primitives are reused
throughout; the only addition is `Progress` (task above), which follows
the same `cva`-free, Tailwind-token, `cn()`-based pattern as the
package's other primitives.

## Verification

driver-portal: `tsc --noEmit` clean, `eslint --max-warnings=0` clean,
`vitest run` 10/10 tests, `next build` clean (8 routes: `/`, `/rewards`,
`/activity`, `/leaderboard`, `/wallet`, `/learn`, `/login`,
`/_not-found`). Backend: `tsc`, `eslint`, `jest --runInBand` 131/131
suites, 892/892 tests (includes the plumbing gaps above). SDK: `tsc`,
`eslint`, `vitest` 66/66 (includes new `frontend-wiring.e2e.spec.ts`
assertions covering the driver-portal SDK barrel and its live-method
wiring). `packages/types` and `packages/ui` both build clean.
