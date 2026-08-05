# DPX-MERCHANT-009 — Notifications

## 1. Scope (Merchant Phase 2, per founder's locked sequencing)

Per the founder's strategic-sequencing decision (see
`docs/DPX-COMMERCIAL-001-REVENUE-SETTLEMENT-CREDIT-POLICY.md` §0.1):
continue Merchant Phase 2 UI work — Reviews (done), **Notifications
(this doc)**, Analytics, remaining merchant screens — while
DPX-COMMERCIAL-001 stays locked-but-deferred until Merchant Phase 2
reaches its production audit and freeze.

Give merchants a real notification centre: view order activity, wallet
settlements, account/KYC updates and other platform notifications, mark
individual or all notifications read, delete notifications, and manage
per-channel/per-type notification preferences — using only existing
backend capability. No new notification types, delivery channels, or
moderation/broadcast features were invented for this screen.

## 2. Reality audit

`NotificationCenterService` and the `Notification`/`NotificationPreference`
models already existed, fully built and already proven in production by
`CustomerNotificationsController` and `DriverNotificationsController`
(`GET /customer/notifications`, `GET /driver/notifications`, etc.). Unlike
Reviews, there is **no `MerchantProfile.id` vs `User.id` split** here —
`Notification.userId` is directly `User.id`, so no authorization bug was
possible in this area. Merchants already receive real rows in this table
today (`ORDER_PLACED`, `MERCHANT_APPROVAL`, `WITHDRAWAL_REQUESTED`,
`WITHDRAWAL_COMPLETED`, `WITHDRAWAL_FAILED`, `ORDER_ACCEPTED`, etc. — see
`NotificationType`) — they simply had no way to read them. Three genuine
gaps, all closed here:

### 2.1 No merchant-facing controller existed

Only `customer/notifications` and `driver/notifications` routes existed.
Closed by adding `MerchantNotificationsController` — a direct mirror of
`DriverNotificationsController`, reusing `NotificationCenterService`
unmodified (`list`, `markRead`, `markAllRead`, `delete`,
`listPreferences`, `updatePreferences`).

### 2.2 The merchant role had no permission to read/manage notifications

`NOTIFICATION_CENTER_PERMISSIONS.CUSTOMER_READ` /
`.CUSTOMER_MANAGE` (`customer:notifications:read` /
`customer:notifications:manage`) are not portal-exclusive despite the
name — `DriverNotificationsController` already reuses the identical pair,
with a doc comment establishing that precedent. The `merchant` role in
`seed-data/role-permissions.ts` was simply missing both grants; every
other portal role (`customer`, `rider`, `driver`, `super_administrator`)
already had them. Added the two grants and re-ran the idempotent
`prisma db seed` (via `prisma:seed`, upsert-based — safe to re-run
additively against the live dev database, no migration needed).

### 2.3 The SDK pointed the merchant portal at the wrong route

`MerchantSdk.notifications` was wired to `client.notifications`, whose
`NotificationsClient` defaults to basePath `/customer/notifications` — so
even with the controller and permissions fixed, the merchant portal would
have been calling the _customer_ route (and would have 403'd once
permissions were correctly scoped, since a merchant user has no
`customer` role). Fixed by adding a dedicated
`DripplexClient.merchantNotifications: NotificationsClient` instance
(basePath `/merchant/notifications`, same pattern already used for
`driverNotifications`), and rewiring `createMerchantSdk()` to expose it as
`notifications: client.merchantNotifications`.

### 2.4 What was deliberately not built

- **No push/email/SMS delivery UI.** The channel dimension already exists
  in `NotificationPreference` (`channel` + `type` + `enabled`), and the
  preferences endpoints are wired end-to-end, but no push-token
  registration flow exists for the merchant portal (it's a web app; no
  `DeviceToken` registration screen was in scope here or requested).
  Preferences can be read/updated via the SDK; the frontend does not yet
  surface a preferences UI (see §7 below).
- **No header bell/unread-count badge.** Only the dedicated
  `/notifications` page was built, consistent with how Reviews shipped as
  a standalone page rather than a global widget. A shell-level bell icon
  was not requested and was not added.
- **No new notification types or broadcast/moderation actions.** The
  existing `NotificationCenterService` surface was reused exactly as-is.

## 3. Backend changes

- `MerchantNotificationsController` (new) — mirrors
  `CustomerNotificationsController`/`DriverNotificationsController`
  exactly: `GET /merchant/notifications`,
  `PATCH /merchant/notifications/:id/read`,
  `POST /merchant/notifications/mark-all-read`,
  `DELETE /merchant/notifications/:id`,
  `GET /merchant/notifications/preferences`,
  `PUT /merchant/notifications/preferences`. `list`/`getPreferences` guarded
  by `CUSTOMER_READ`; the four mutation routes by `CUSTOMER_MANAGE`.
- `NotificationCenterModule` — registers the new controller.
- `NotificationCenterService` — unchanged; already portal-agnostic and
  `userId`-scoped.
- `prisma/seed-data/role-permissions.ts` — added
  `customer:notifications:read`/`customer:notifications:manage` to the
  `merchant` role array.

## 4. SDK

- `DripplexClient.merchantNotifications` (new) —
  `new NotificationsClient(this.http, '/merchant/notifications')`.
- `sdk-merchant.ts` — `createMerchantSdk()` now exposes
  `notifications: client.merchantNotifications`. (Minor follow-up noted:
  the `MerchantSdk` interface still types this field as
  `DripplexClient['notifications']` rather than
  `DripplexClient['merchantNotifications']` — both resolve to
  `NotificationsClient`, so this compiles correctly today, but should be
  corrected for clarity next time this file is touched.)
- No new shared types needed — `NotificationDto`,
  `NotificationPreferenceDto`, and `NotificationListResult` already
  covered the response shapes.

## 5. Frontend — `apps/merchant-portal/src/app/(dashboard)/notifications/page.tsx`

- Header with a "Mark all as read" action (disabled once there are no
  unread items).
- "Unread only" `Switch` filter, backed by the real `unreadOnly` query
  param.
- One row per notification: unread dot indicator + tinted background for
  unread rows, category `Badge` (from the real `NotificationCategory`
  enum), title, body, real formatted `createdAt`, and a per-row
  Mark-read/Delete action.
- `EmptyState` for zero notifications (copy differs for the unread-only
  filter vs. the base empty state).
- Loading spinner on first load, inline `role="alert"` error text, same
  `Previous`/`Next` pagination pattern as every other Phase 2 list screen,
  15s polling to keep the list live.
- Nav item added to `sidebar.tsx` and `mobile-nav-drawer.tsx` (`Bell`
  icon, positioned after Reviews).

## 6. Live verification

Backend started against the real dev Postgres/Redis;
`pnpm run prisma:seed` re-run first to apply the new `merchant` role
grants (confirmed via the seed log: "Seeded 107 permissions, 9 roles, and
role-permission grants"). A temporary `verify-notifications.script.ts`
created a real merchant user + `MerchantProfile` via Prisma (with
`phoneVerifiedAt` set, required by `loginMerchant`'s
`requiresPhoneVerification` check), logged in via the real
`POST /auth/login/merchant`, seeded three real `Notification` rows plus
one belonging to a different user (to prove `userId` scoping), then drove
the exact HTTP contract:

- `GET /merchant/notifications` → returns exactly the 3 own notifications,
  correctly excludes the other user's row, real `createdAt desc` ordering
  confirmed against explicit fixture timestamps.
- `GET ?unreadOnly=true` → returns exactly the 2 unread rows.
- `PATCH /merchant/notifications/:id/read` → `200`, sets a real `readAt`.
- `POST /merchant/notifications/mark-all-read` → `201` (no `@HttpCode`
  override on this route), `updated: 1` (only the one remaining unread
  row), confirmed unread count is `0` immediately after.
- `GET /merchant/notifications/preferences` → `200`, array response.
- `PUT /merchant/notifications/preferences` → `200`, persisted row
  returned with `enabled: false` as sent.
- `DELETE /merchant/notifications/:id` → `204`, confirmed `total` drops
  from 3 to 2.
- Unauthenticated `GET /merchant/notifications` → `401`.

All 29 assertions passed. Fixtures were deleted at the end of the run
(including the seeded user/profile); the script file was deleted after;
confirmed zero leftover fixture rows.

Backend suite: `pnpm exec jest --config ./jest.config.ts
"src/notification-center" "src/reviews" "src/orders" "src/wallet"` →
**26 suites passed, 214/214 tests passed** (includes the new
`notification-center.permissions.spec.ts` case covering the merchant
controller's permission wiring).

Frontend/SDK: `tsc --noEmit`, `eslint --max-warnings=0`, and `next build`
all clean, including the new `/notifications` route in the build output.

## 7. Files changed

- `apps/backend/src/notification-center/merchant-notifications.controller.ts` — new.
- `apps/backend/src/notification-center/notification-center.module.ts` — registers it.
- `apps/backend/src/notification-center/notification-center.permissions.spec.ts` — new test case.
- `apps/backend/prisma/seed-data/role-permissions.ts` — merchant role grants.
- `packages/sdk/src/client/dripplex-client.ts` — `merchantNotifications` client.
- `packages/sdk/src/sdk-merchant.ts` — rewired `notifications` binding.
- `apps/merchant-portal/src/app/(dashboard)/notifications/page.tsx` — new.
- `apps/merchant-portal/src/components/layout/sidebar.tsx` /
  `mobile-nav-drawer.tsx` — nav item.

## 8. Known gaps (honest, not fixed here)

- No preferences UI surfaced in the frontend yet — the endpoints are live
  and SDK-wired, but the `/notifications` page does not expose a settings
  panel for them.
- No header bell/unread-count widget outside the dedicated page.
- The `MerchantSdk` interface's `notifications` field type should be
  updated to `DripplexClient['merchantNotifications']` for clarity (not a
  functional bug — both are `NotificationsClient` — but worth correcting
  next time this file is touched).

## 9. Next step

Continue the locked Phase 2 order: Analytics + store controls (#388),
then the module-level E2E/security/production-audit pass (#389–#391).
