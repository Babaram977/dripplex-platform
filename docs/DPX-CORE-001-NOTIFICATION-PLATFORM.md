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
