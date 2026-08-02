# DPX-CORE-001 — DrippleX Notification Platform

**Status: Phase B-1 implemented.** Items 1-5 below (device registry,
provider adapters, ride event wiring, sound mapping, customer-web bell)
are built and verified — see the "Implementation record" at the bottom
for exactly what shipped, including the one honest gap found while
building it (refund notifications have no real trigger yet).

Founder-approved direction (2026-08-02): consolidate into the existing
`notification-center` module rather than build a parallel system — "one
implementation, not seven." This doc records what a full reality audit
found already exists, what's genuinely missing, and the scope of this
implementation pass.

## What already exists (verified by reading the real code, not assumed)

`apps/backend/src/notification-center/` is a mature, DB-backed module,
already wired into `AppModule`:

- **Schema** (`prisma/schema.prisma`): `Notification`, `NotificationPreference`,
  `NotificationTemplate`, `NotificationDeliveryAttempt` models; enums
  `NotificationChannel` (PUSH/EMAIL/SMS/IN_APP/WHATSAPP), `NotificationType`
  (16 values), `NotificationStatus` (PENDING→QUEUED→SENT/FAILED/DEAD_LETTER),
  `NotificationPriority` (LOW/NORMAL/HIGH/CRITICAL — already matches the
  founder's priority-tier ask exactly).
- **Service** (`notification-center.service.ts`): `send`/`broadcast`/`resend`,
  preference-gated delivery (skips if the user disabled that
  channel+type), template interpolation, retry with dead-lettering after
  3 attempts, full audit logging.
- **Event-driven ingestion** (`notification-center.subscriber.ts`): listens
  on the in-process `DomainEventBus` for a fixed map of events (orders,
  payments, delivery, auth, inventory, merchant/rider approval, promotions)
  and turns each into a persisted `IN_APP` notification.
- **Controllers**: customer (list/read/delete/preferences) + admin
  (template CRUD, broadcast, resend).
- **SDK/types**: `sdk.notifications.*` and matching DTOs already exported
  from `@dripplex/sdk`/`@dripplex/types` — client-ready, just unconsumed.

## What's genuinely missing

1. **Delivery is a stub everywhere.** `NotificationCenterService.sendToChannel()`
   just logs and returns `{provider: 'stub'}`. A second, older, _separate_
   port (`NOTIFICATION_SERVICE` / `LoggingNotificationService`, used by
   rides/payments/auth for transactional email) is also log-only. No
   FCM/APNs/Termii/Twilio/SendGrid/SES package is installed anywhere
   (confirmed by dependency + import grep).
2. **Two disconnected systems.** Ride/payment code calls the old
   `NOTIFICATION_SERVICE` port directly — those events never create a
   `Notification` row and never appear on `GET /customer/notifications`.
   This is the "seven implementations" problem already present in
   miniature; reconciling it is the core of this pass.
3. **No device/push-token registry** — no model exists, a real gap for
   push delivery of any kind.
4. **Ride domain never emits anything onto `DomainEventBus`.** Ride uses
   its own `RideEventsPublisher` (WS-only, best-effort, `ride-events.publisher.ts`)
   for realtime UI updates and calls `NOTIFICATION_SERVICE` directly for
   email — it has never touched the event-bus/subscriber pattern every
   other domain (orders, delivery, auth) already uses for the persisted
   in-app feed.
5. **`NotificationType.REFUND` is defined but dead** — grepped the whole
   ride payment path: no refund notification is ever sent today, despite
   the enum value existing.
6. **No sound abstraction, no frontend notification UI in any app.**
   Confirmed: no `use-notifications` hook anywhere, no notification
   bell/inbox/badge in customer-web or any other app — the only frontend
   reference to `sdk.notifications` is a backend-health-check ping that
   discards its result.

## Target architecture (grounded in the above, not a rewrite)

```
DPX-CORE-001 Notification Platform  (= notification-center, extended)
│
├── Notification Center (exists)         — storage, list, read/unread, delete
├── Preferences (exists)                 — per (channel, type), default-allow
├── Templates (exists)                   — {{var}} interpolation, admin CRUD
├── Priority + retry/dead-letter (exists)— LOW/NORMAL/HIGH/CRITICAL
├── Device Token Registry (NEW)          — multi-device per user
├── Provider Adapters (NEW, formalized)  — Push/Email/SMS behind one interface,
│                                          each returns NotConfigured until
│                                          real credentials exist (Phase D)
├── Sound Event Mapping (NEW)            — NotificationType -> sound event name,
│                                          real audio files deferred (Phase C)
├── Domain event wiring (EXTENDED)       — ride lifecycle + payment/refund
│                                          events added to the existing
│                                          subscriber map
└── In-app notification UI (NEW)         — customer-web first; bell, list,
                                            badge count, mark-read, using the
                                            already-built SDK client
```

Every module (Ride, Delivery, Marketplace, Wallet, Merchant, Driver,
Admin) reaches this through the same two seams that already exist and
require no per-module notification code: emit a `DomainEventBus` event,
or call `NotificationCenterService.send()`/`.broadcast()` directly for
cases an event doesn't fit. Adding a channel later (WhatsApp, Telegram,
Web Push) means adding one adapter behind the existing interface — no
business-logic call site changes, because callers only ever depend on
`NotificationChannel`, never on a specific provider.

## Scope of this implementation pass (Phase B-1)

1. **Device registry**: `DeviceToken` Prisma model (userId, platform
   [IOS/ANDROID/WEB], token, active, lastSeenAt) + migration; service +
   customer controller (`register`/`list`/`deactivate`); SDK client +
   types.
2. **Provider adapters, formalized**: a `PushProvider`/`EmailProvider`/
   `SmsProvider` interface per channel, each with a `NotConfigured`
   implementation as the default binding (explicit, typed result —
   `{status: 'not_configured'}` — not silent logging pretending success).
   `sendToChannel()` now calls the right adapter by channel instead of
   its old generic stub.
3. **Ride domain event wiring**: new `DOMAIN_EVENTS` entries
   (`RideDriverAssigned`, `RideDriverArrived`, `RideStarted`,
   `RideCompleted`, `RidePaymentSucceeded`, `RidePaymentFailed`,
   `RideRefunded`) + 4 new `NotificationType` enum values for the ones
   that don't already have a generic equivalent (payment success/failure
   and refund reuse the existing `PAYMENT_SUCCESS`/`PAYMENT_FAILED`/
   `REFUND` types). Emitted additively from
   `ride-dispatch.service.ts`/`ride-trip.service.ts`/`ride-payment.service.ts`
   alongside their existing WS publish/`NOTIFICATION_SERVICE` calls —
   those are untouched, this is additive wiring into the persisted feed,
   not a rewrite of frozen payment code. 6 of the 7 mappings (assigned/
   arrived/started/completed/payment succeeded/payment failed) have a
   real emission call site and are live. **`RideRefunded` does not** — a
   second reality check while wiring this up confirmed no ride refund
   flow exists anywhere in the backend (`WalletService.refund()` exists
   as a generic primitive but is never called from `rides/*`). Deciding
   when a ride should be refunded (which cancellation reasons, full vs.
   partial, automatic vs. admin-approved) is a real product/business
   policy decision, not something to invent while wiring notifications —
   so the mapping is registered and ready, but dormant, until that policy
   exists and a real call site can emit it honestly. The dead `REFUND`
   `NotificationType` stays dead for the same reason it was dead before
   this pass; documenting that plainly here beats silently claiming a fix
   that isn't real.
4. **Sound event mapping**: a small `NOTIFICATION_SOUND_EVENTS` constant
   mapping `NotificationType` → a sound-event name (e.g.
   `RIDE_COMPLETED` → `ride_completed`), exposed as a computed field on
   `NotificationDto`. No audio files — that's Phase C, and depends on
   assets the founder said he'd commission.
5. **Customer-web in-app notification UI**: a notification bell + badge
   count in the dashboard header, a list screen (reusing the already-built
   `sdk.notifications.list/markRead/markAllRead`), composed from existing
   dashboard UI primitives — first real consumer of the SDK client that's
   existed unused since before this pass.

## Explicitly deferred (not this pass)

- **Real push/SMS/email provider credentials** (FCM, APNs, Termii,
  Twilio, SES/SendGrid/Resend) — these are deployment secrets, not code;
  Phase D per the founder's own sequencing.
- **Real sound asset files** — Phase C, depends on commissioned audio.
- **Notification UI in merchant-portal/driver-portal/rider-portal/
  admin-portal/operations-console** — the backend/SDK now supports all of
  them identically, but building UI in apps not currently being worked on
  would be speculative; add it when those apps are next actively touched.
- **Marketing campaigns, A/B testing, scheduled broadcasts** — the
  `Notification.scheduledAt` field and `broadcast()` method already exist
  as primitives; campaign tooling on top of them is Phase 3 per the
  founder's own plan, not built speculatively now.
- **WhatsApp/Telegram/Web Push adapters** — the adapter interface is
  designed so adding these later is additive, but none is built now since
  none has a real provider account either.

## Implementation record (Phase B-1)

1. **Device registry** — `DeviceToken` model + migration
   (`20260802000000_add_notification_platform_device_tokens`);
   `DeviceRegistryService` (register upserts on `(userId, platform, token)`
   so re-registering the same device reactivates it; list; deactivate,
   ownership-checked); `CustomerDevicesController`
   (`POST/GET /customer/devices`, `DELETE /customer/devices/:id`, reusing
   the existing customer notification permissions — no new permission
   strings, no seed changes needed); SDK `sdk.devices.*` + types.
2. **Provider adapters** — `NotificationProvider` interface
   (`providers/notification-provider.ts`) + `NotConfiguredProvider`
   default binding for PUSH/EMAIL/SMS. `NotificationCenterService.sendToChannel`
   now dispatches by channel: IN_APP always succeeds (no external step —
   the persisted row is the delivery), PUSH/EMAIL/SMS call their adapter,
   WHATSAPP reuses the same "not configured" shape (no dedicated adapter
   — no real usage anywhere to build one against yet).
   `attemptDelivery` now treats an unconfigured-provider result as an
   honest, immediate terminal `DEAD_LETTER` instead of burning through
   `maxRetries` on something retrying can never fix.
3. **Ride domain events** — `RideDriverAssigned`/`RideDriverArrived`/
   `RideStarted`/`RideCompleted`/`RidePaymentSucceeded`/`RidePaymentFailed`
   added to `DOMAIN_EVENTS` and the `NotificationCenterSubscriber` map;
   emitted additively (existing WS/email calls untouched) from
   `ride-dispatch.service.ts` (`acceptOffer`), `ride-trip.service.ts`
   (`notifyAndPublish`, shared by markArrived/startTrip/completeTrip), and
   `ride-payment.service.ts` (`notifyPaymentOutcome`). `RideRefunded` is
   mapped but **not emitted anywhere** — confirmed no ride refund flow
   exists in the backend (`WalletService.refund()` is a generic primitive,
   never called from `rides/*`); inventing when/how a ride gets refunded
   is a real policy decision, not something to decide while wiring
   notifications. `NotificationType.REFUND` stays dead until that policy
   exists.
4. **Sound event mapping** — `NOTIFICATION_SOUND_EVENTS` /
   `getNotificationSoundEvent()` in `@dripplex/types`, a pure client-side
   lookup from the already-returned `NotificationDto.type` (no new backend
   field — there's no `soundEvent` column to add without a real reason,
   and the backend doesn't map `Notification` through a DTO mapper today
   to begin with). Real audio files are Phase C, unchanged from the plan.
5. **Customer-web notification bell** — `NotificationBell`
   (`components/layout/notification-bell.tsx`) replaces the dashboard
   header's previously decorative, unwired `Bell` button. Badge count,
   dropdown list (10 most recent), mark-one-read, mark-all-read, explicit
   loading/error/empty states — the first real consumer of
   `sdk.notifications.*`, which existed fully built and SDK-ready since
   before this pass with zero UI anywhere using it. `use-notifications.ts`
   hook (`useNotifications`, `useMarkNotificationRead`,
   `useMarkAllNotificationsRead`, `useUnreadNotificationCount`).

Verification: backend `tsc --noEmit` clean, full backend `jest` suite
823/823 passed (123/123 suites); customer-web `tsc --noEmit` clean,
`eslint --max-warnings=0` clean, `vitest run` 4/4 passed, `next build`
clean (21/21 routes). SDK/types packages rebuilt (`dist`) so downstream
consumers pick up the new exports.

## Phase 1 (founder-approved 2026-08-02): complete the notification core before Firebase

Per the founder's sequencing — finish the model, then Referral, then
Promo, then Firebase (so push benefits every existing notification type
at once instead of only Ride), then SOS last (an SOS that only writes a
DB row isn't a real SOS system).

- **`NotificationCategory`** — new enum (RIDE/DELIVERY/MARKETPLACE/WALLET/
  MERCHANT/ADMIN/SUPPORT/EMERGENCY/MARKETING/SYSTEM/SECURITY), new
  `Notification.category` column (`NOT NULL DEFAULT 'SYSTEM'` — the
  default only backfills pre-existing rows; every new `send()`/`create()`/
  `broadcast()` call requires it explicitly via `CreateNotificationDto`/
  `BroadcastNotificationDto`, it's never inferred from `type`). Deliberately
  orthogonal to `NotificationType`: `PAYMENT_SUCCESS`/`PAYMENT_FAILED` are
  reused across both ride and marketplace payments, so category can't be
  derived from type alone — every `NotificationCenterSubscriber` mapping
  now sets it explicitly per domain event.
- **`expiresAt`** — new nullable `Notification.expiresAt` column + index.
  Not populated by anything yet (no caller sets it) — it's schema-ready for
  whichever feature first needs auto-expiring notifications (e.g. a stale
  "driver arrived" alert), not retrofitted onto existing types speculatively.
- **`deepLink`/`image`/`sound` stay in `payload`**, not promoted to columns
  — per the founder's own reasoning, matching what was already recommended:
  no query pattern needs them as indexed columns today.
- **Payload versioning** — every payload the subscriber constructs now
  starts with `version: 1` before the domain event's own fields, centralized
  in `NotificationCenterSubscriber.handle()` (not duplicated at each ride
  event's `eventBus.emit()` call site, since the version stamp is applied
  once, downstream, right before persistence). Lets client apps evolve how
  they read `payload` without breaking older builds.
- **Category filtering** — added to `ListNotificationsQueryDto`/
  `NotificationListQuery`/`sdk.notifications.list()`, matching the existing
  status/channel/type filters, so `GET /customer/notifications?category=RIDE`
  works today even before any UI groups by category.

Migration: `20260802010000_add_notification_category_expires`. Verified:
backend `tsc`/full `jest` suite green, SDK/types/customer-web `tsc`/
`eslint`/`vitest`/`next build` all green.

Next: RIDE-004.1 (Referral backend) and RIDE-004.2 (Promo, likely
extending the existing `promotions` module to accept ride fares rather
than building a second promo system — to be confirmed against real code
before large implementation, same discipline as everything else here).

## Phase D (2026-08-02): real Firebase Cloud Messaging for PUSH

`PUSH_PROVIDER` now binds `FirebasePushProvider` instead of
`NotConfiguredProvider('fcm')` whenever `FIREBASE_PROJECT_ID`,
`FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` are all set (the
founder supplied the `dripplex-3a92d` service account) — exactly the seam
the Phase B-1 doc comment called out: "Swapping in a real FCM/APNs...
adapter later means changing only these three factories." No caller of
`NotificationCenterService` changed; the seam held.

- **`FirebasePushProvider`** (`notification-center/providers/`) fans a
  push out to every active `DeviceToken` for the notification's `userId`
  (`DeviceRegistryService.list()`), via `Messaging.sendEach()` — not the
  newer `sendEachForMulticast`, which is deprecated in favor of an
  overload expecting Firebase Installation IDs (fids); `DeviceToken.token`
  stores classic FCM registration tokens, which `sendEach` (one `Message`
  per token) still accepts directly.
- **Zero registered devices is not a failure.** If a user has no active
  `DeviceToken`, the provider returns `{ configured: true, provider: 'fcm' }`
  without calling FCM at all — the credentials are valid and reachable,
  there's just nothing to push to yet. Treating this as `configured: false`
  would incorrectly dead-letter the notification with "no provider
  configured," which is a different, false statement.
- **Stale tokens self-heal.** Any token FCM reports as
  `registration-token-not-registered` or `invalid-registration-token` is
  deactivated immediately via `DeviceRegistryService.deactivate()` — it can
  never succeed on retry, and left active it would get resent on every
  future push to that user forever. Every other FCM error code (rate
  limits, transient failures) leaves the token alone.
- **`getFirebaseMessaging()`** (`firebase-admin.factory.ts`) initializes a
  _named_ Firebase Admin app (`dripplex-notification-center`, not the
  SDK's default app) so it can't collide with an app some other module
  initializes later, and reuses it across calls — `initializeApp()` throws
  if called twice for the same name, which matters when Nest recreates
  this module (e.g. across test suites in the same process).
- **Constructor takes `Messaging`, not `App`.** The module's
  `PUSH_PROVIDER` factory resolves `Messaging` once via
  `getFirebaseMessaging(config)` and injects that into
  `FirebasePushProvider`, rather than the provider resolving it itself —
  so tests construct the provider with a plain fake `{ sendEach: jest.fn() }`
  object, no module-level mocking of the `firebase-admin` SDK required.

### Credentials are environment configuration, never committed

`FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY`
were added to `env.validation.ts` (all optional, default `''`, following
the exact pattern `PAYSTACK_SECRET_KEY` etc. already used) and to
`AppConfigService` (plus a `firebaseConfigured` getter the module's
factory checks). The real values live only in whatever secret store the
deployment target uses (Railway/Coolify env vars) — `.env.example` at the
repo root got three blank placeholder lines and a comment, nothing more.
The actual service account JSON the founder shared in chat was read to
extract these three values and was not written to any file in this repo
or committed.

### Not in this pass: browser/web push registration

The founder also shared a Web Push certificate (VAPID) key from the
Firebase Console's Cloud Messaging tab. That key is for a _different_ half
of FCM — registering a browser for push via `getToken(messaging, { vapidKey })`
and a service worker — which none of the portal apps do yet (no service
worker, no `POST /device-tokens` call from any frontend). `FirebasePushProvider`
only sends to tokens already present in `DeviceToken`; it doesn't create a
path to get one from a browser. Native apps (once `driver-mobile`/
`customer-mobile` register real FCM tokens via Capacitor's
`@capacitor/push-notifications`) don't need the VAPID key at all — it's
web-only. Flagging this now rather than silently dropping the key: worth
wiring once a portal actually needs browser push, not before.

Verification: backend `tsc --noEmit` clean, `eslint --max-warnings=0`
clean, `jest --runInBand` 132/132 suites, 896/896 tests (4 new tests in
`firebase-push.provider.spec.ts`).

## Phase D-2 (2026-08-02): client FCM registration

Phase D made the backend able to _send_ push. This phase makes a client
actually _register_ for it — closing the "no device ever calls
`POST /customer/devices`" gap that made `FirebasePushProvider` untested
against a real token until now. Founder supplied the Firebase web-app
config (`apiKey`/`authDomain`/`projectId`/`messagingSenderId`/`appId`)
and the Cloud Messaging VAPID key in this pass, which is what unblocked
the web-push half below.

### What actually exists to wire this into

A repo-wide check before writing any code found **one** real mobile
pathway, not four. `apps/customer-mobile` is a Capacitor **remote-URL
shell** — `capacitor.config.ts` points `server.url` at the deployed
customer-web app; there's no separate mobile-app source tree. That means
the code that runs inside the native shell _is_ customer-web's own
bundle, and any native plugin call has to live there, not in
`customer-mobile`. `apps/merchant-mobile`, `apps/rider-mobile`, and any
driver-mobile app **do not exist** — `docs/mobile/MERCHANT-RIDER-PACKAGING.md`
already documented Merchant/Rider mobile as "planned (post-D4),
duplicate the customer-mobile pattern," never built; a Driver mobile app
has no plan document at all, since `driver-portal` (web) only shipped
this same day and Capacitor-wrapping it was never decided. Per instruction,
this phase stops at the shared integration layer for those three and
documents the gap rather than scaffolding apps nobody asked to exist yet.

### Shared layer: `usePushRegistration` (`@dripplex/hooks`)

One hook, usable by any portal app today with zero config: with no
Firebase web config and no Capacitor shell, every code path inside it
resolves to a no-op. Split into independently-tested pieces rather than
one large effect:

- **`native-push.ts`** — `Capacitor.isNativePlatform()` detection +
  `@capacitor/push-notifications` permission/token flow, wrapped so
  permission denial, a registration error, or a 15s timeout all resolve
  `null` rather than reject (a provider that throws for "no token" would
  make every unauthenticated device look like a crash).
- **`web-push.ts`** — browser `Notification.requestPermission()` +
  Firebase JS SDK `getToken()` against a service-worker registration.
  Deliberately still uses the deprecated `getToken()` API rather than the
  newer FID-based `register()`/`onRegistered()` flow, for the identical
  reason `firebase-push.provider.ts` still uses `Messaging.sendEach()`
  server-side: `DeviceToken.token` is a classic FCM registration token,
  not a Firebase Installation ID, and the two aren't interchangeable.
- **`push-registration-service.ts`** — 3-attempt exponential-backoff
  retry around `devicesClient.register()`. Safe to retry freely because
  `DeviceRegistryService.register()` is an upsert keyed on
  `(userId, platform, token)` — a retried call can never create a
  duplicate row, so "keep registration idempotent" is a property of the
  backend this phase didn't need to re-implement client-side.
- **`use-push-registration.ts`** — the React glue: registers on the
  `isAuthenticated` false→true transition, deregisters (best-effort,
  swallowing failures — a stale token still self-heals server-side the
  next time FCM reports it dead) on the true→false transition. The
  registered device's id is cached in `localStorage` so logout can find
  it without an extra list-devices round trip.

### Wired into customer-web (the one app with a real mobile pathway)

- `<PushRegistration />` (`src/components/pwa/push-registration.tsx`) —
  renders nothing, mounted once in the root layout next to the existing
  `<ServiceWorkerRegister />`, calls the hook with `sdk.devices` (already
  existed in the SDK, just never had a caller) plus the resolved Firebase
  config.
- `src/lib/firebase-push-config.ts` reads the six `NEXT_PUBLIC_FIREBASE_*`
  env vars and returns `undefined` if any are unset — same
  "gracefully do nothing until configured" contract as the backend's
  `firebaseConfigured` getter.
- **`public/sw.js` was extended, not duplicated.** customer-web already
  ships a hand-written offline-fallback service worker at `/sw.js`; only
  one worker can control a scope, so this phase added Firebase's
  background-message handling into that same file via `importScripts()`
  of the Firebase compat CDN bundles — the officially documented way to
  combine a custom worker with FCM — rather than registering a second,
  competing `firebase-messaging-sw.js`.
- The Firebase web-app config (`apiKey` etc.) and the VAPID key are
  **not secrets** — Firebase's own docs say this config is safe in a
  client bundle, unlike the Admin SDK service account Phase D used — so
  real values went directly into `.env.example` (both root and
  `apps/customer-web/`) and into `public/sw.js` itself, rather than
  blank placeholders.

### Explicitly out of scope, per instruction

- **Merchant mobile, Rider mobile, Driver mobile apps.** None exist in
  this repo. Building them was not requested this pass and would be
  fabricating product/platform decisions (bundle IDs, store listings,
  signing) nobody has made. `driver-portal`/`merchant-portal`/`rider-portal`
  are real web apps that _could_ receive the same web-push wiring
  customer-web just got — that's a small, well-understood follow-up, not
  done here since it wasn't the ask.
- **Real native FCM/APNs delivery.** `google-services.json` in
  `apps/customer-mobile/android/app/` is still only the `.example`
  template — no Android app is actually registered against the
  `dripplex-3a92d` Firebase project. No `GoogleService-Info.plist` or
  APNs key exists for iOS either. `usePushRegistration`'s native path is
  real, tested code, but it has never been exercised against a real
  native build — it will silently fail permission/registration until
  those config files exist. Documented in `docs/mobile/PUSH-NOTIFICATIONS.md`'s
  status table, not silently assumed working.
- **Foreground `onMessage()` handling.** Only `onBackgroundMessage()` was
  added to `sw.js`. A foreground browser tab still relies on
  `NotificationBell`'s existing 60-second poll, not an instant push
  event — no `onMessage()` listener was added to any page, since that's a
  UI-visible behavior change (toast-on-push) beyond "register the
  device," not requested this pass.

Verification: `@dripplex/hooks` `tsc --noEmit` clean, `eslint --max-warnings=0`
clean, `vitest run` 10/10 tests (native-push, web-push,
push-registration-service). customer-web `tsc`, `eslint`, `vitest`
(4/4), `next build` (21/21 routes) all clean.

## Phase D-3 (2026-08-02): foreground UX + notification-center sync

D-2 registered devices for push. This phase makes an already-open app
_react_ to one (toast/sound/vibrate/badge) and makes tapping a push —
foreground, background, or native — land on the right screen with the
notification marked read, closing the loop D-2's own doc explicitly
called out as deferred ("no `onMessage()` listener was added").

### Deep links are now real, not guessed

`NotificationCenterSubscriber`'s `NotificationEventMapping` gained an
optional `deepLink` field, set to `/ride` for the four ride-lifecycle
mappings only (`RIDE_DRIVER_ASSIGNED`/`ARRIVED`/`STARTED`/`COMPLETED`) —
the one destination in customer-web unambiguous enough to be worth
wiring. Every other event type (orders, wallet, referrals, promotions)
was deliberately left without one: customer-web has no per-order or
per-transaction detail route today, so mapping them would mean guessing
a destination rather than reflecting one that exists. `handle()` merges
`deepLink` into the persisted `payload` when present;
`FirebasePushProvider.extractDeepLink()` reads it back out of that same
`payload` and forwards it as FCM `data.deepLink` — the actual field a
service worker or native tap handler receives, since `data` (not
`payload`) is what crosses the wire in a push message.

### Foreground: toast, chime, vibration, badge

- **`useForegroundPush`** (`@dripplex/hooks`) wraps Firebase's
  `onMessage()` — the foreground-only counterpart to `sw.js`'s
  `onBackgroundMessage()` from D-2. Mounted via customer-web's new
  `<ForegroundPushListener />`, gated on `isAuthenticated` (an
  unauthenticated visitor never has a registered device, so there's
  nothing for it to receive).
- **No sound asset file exists in this repo** — Phase C explicitly
  deferred "real audio files." Rather than reference a file that isn't
  there, `playNotificationChime()` synthesizes a short tone via the Web
  Audio API (`AudioContext` oscillator + gain envelope). A real sound,
  not a fabricated path.
- **`vibrateForNotification()`** — `navigator.vibrate()`, a silent no-op
  on desktop browsers (no vibration hardware), which is correct behavior,
  not a bug to work around.
- **`setAppBadgeCount()`** wraps the Web Badging API
  (`navigator.setAppBadge`/`clearAppBadge`) — unsupported in most desktop
  browsers today, same "graceful no-op" contract as everything else in
  this module. `useSyncAppBadge()` (customer-web) mirrors the existing
  `useUnreadNotificationCount()` value onto it, gated on
  `isAuthenticated` for the same reason as the listener above — it's
  mounted in the root layout, not just inside the authenticated dashboard
  section like the bell already was.
- **Toast is intentionally not clickable.** `@dripplex/ui`'s `toast()`
  has no `onClick`/action slot, and adding one is a shared-component
  change outside this pass's scope. The toast is ambient awareness only;
  the OS notification (background) and the bell dropdown (via the query
  invalidation below) are the real tappable/actionable surfaces.

### Tap-to-navigate + read sync, three paths

- **Background (web):** `sw.js`'s `onBackgroundMessage` now attaches
  `data` (including `deepLink`/`notificationId`) to the shown
  notification's options. A new `notificationclick` listener reads it
  back, then either `WindowClient.navigate()`s an already-open tab or
  `clients.openWindow()`s a new one, at
  `{deepLink ?? '/dashboard'}?readNotification={id}`.
- **App-side:** `<ReadNotificationOnOpen />` (mounted root-layout-wide)
  reads that `readNotification` param from `window.location` on mount,
  calls `sdk.notifications.markRead()`, then strips the param via
  `history.replaceState` so a refresh doesn't re-fire it. Deliberately
  reads `window.location` directly rather than `useSearchParams()` —
  that hook forces every consuming route out of static generation unless
  wrapped in Suspense, and this component is mounted on all of them.
  Verified: `next build` still shows all 21 routes as `○ (Static)`.
  The worker can't call `markRead` itself — it has no access to the
  page's in-memory auth token — so this two-step (open at a URL, then let
  the authenticated page finish the job) is the realistic shape, not a
  shortcut.
- **Native:** `listenForNativeNotificationTaps()`
  (`@dripplex/hooks/notifications/native-push.ts`) wraps Capacitor's
  `pushNotificationActionPerformed` listener. Capacitor already
  foregrounds the app on tap, so `<NativeNotificationTapHandler />`
  (customer-web) can call `markRead` and `router.push()` directly — no
  query-param round trip needed, unlike the background/web path.

### Explicitly out of scope, per instruction

- **Deep links for non-ride events.** Documented above — not a gap so
  much as an honest reflection of which customer-web routes actually
  exist today.
- **A clickable toast.** Would require extending `@dripplex/ui`'s shared
  `toast()` component; flagged, not done.
- Everything D-2's own "explicitly out of scope" section already listed
  (merchant/rider/driver mobile apps, real native FCM/APNs config files)
  is still true and unchanged by this phase.

Verification: backend `tsc --noEmit` clean, `eslint --max-warnings=0`
clean, `jest --runInBand` 132/132 suites, 899/899 tests (3 new:
subscriber deepLink mapping + omission, FirebasePushProvider data
forwarding). `@dripplex/hooks` `tsc`, `eslint`, `vitest` 21/21 tests (11
new: notification-effects, foreground-push, native tap listener).
customer-web `tsc`, `eslint`, `vitest` (4/4), `next build` (21/21 routes,
still fully static) all clean.
