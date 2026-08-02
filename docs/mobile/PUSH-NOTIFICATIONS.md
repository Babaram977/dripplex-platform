# Push notifications — mobile readiness

Native push is scaffolded; **backend registration endpoints are unchanged** in D4 (no API changes).

**Update (DPX-CORE-001 Phase D-2):** the backend device API this doc
called "post-D4" now exists (`CustomerDevicesController`,
`DeviceRegistryService`), and `FirebasePushProvider` sends real pushes
through it (see `docs/DPX-CORE-001-NOTIFICATION-PLATFORM.md`'s Phase D
section). Client-side registration described below is wired for
customer-web/customer-mobile via `usePushRegistration`
(`packages/hooks/src/notifications/`) — see that doc's Phase D-2 section
for what's live and what's still a documented gap (merchant/rider mobile
shells don't exist yet; see `MERCHANT-RIDER-PACKAGING.md`).

## Firebase Cloud Messaging (Android)

1. Create Firebase project `dripplex-customer`
2. Add Android app `com.dripplex.customer`
3. Download `google-services.json` → `apps/customer-mobile/android/app/`
4. Gradle auto-applies `google-services` plugin when file present

## Apple Push Notification service (iOS)

1. Enable Push capability in App ID
2. Upload APNs key (.p8) to Firebase **or** use native APNs
3. Set `aps-environment` to `production` in `App.entitlements` for release
4. Optional: `GoogleService-Info.plist` for FCM bridge

## Capacitor plugin

`@capacitor/push-notifications` is installed and wired — see
`packages/hooks/src/notifications/native-push.ts`, called from
`usePushRegistration` on login. The manual sequence below is what that
module does internally; you shouldn't need to call it directly:

```typescript
import { PushNotifications } from '@capacitor/push-notifications';

await PushNotifications.requestPermissions();
await PushNotifications.register();
PushNotifications.addListener('registration', (token) => {
  // POST token to backend when device API exists (post-D4)
});
```

## Notification channels (Android)

Define in native layer or `@capacitor/local-notifications` extension:

| Channel ID   | Name       | Use                     |
| ------------ | ---------- | ----------------------- |
| `orders`     | Orders     | Order status updates    |
| `delivery`   | Delivery   | Rider / parcel tracking |
| `promotions` | Promotions | Marketing (opt-in)      |
| `account`    | Account    | Security, wallet        |

## Deep linking from notifications

Payload `data.url` → open `https://app.dripplex.com/...` or `dripplex://open/...` (configured in manifests).

## Status

| Component                        | Status                                                                                                    |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| FCM config template              | ✅ `google-services.json.example`                                                                         |
| APNS entitlements                | ✅                                                                                                        |
| Plugin dependency                | ✅                                                                                                        |
| Backend device token API         | ✅ DPX-CORE-001 (`CustomerDevicesController`, `DeviceRegistryService`)                                    |
| Backend push delivery            | ✅ DPX-CORE-001 Phase D (`FirebasePushProvider`, real FCM sends)                                          |
| Web Push (VAPID)                 | ✅ DPX-CORE-001 Phase D-2 — wired in customer-web (`usePushRegistration` + `public/sw.js`)                |
| Native token registration (call) | ✅ Phase D-2 — `usePushRegistration` calls `@capacitor/push-notifications` when Capacitor-native          |
| Real Android FCM config          | ❌ `google-services.json` is still only the `.example` template — no real Firebase Android app registered |
| Real iOS APNs config             | ❌ No `GoogleService-Info.plist`, no APNs key uploaded — untested end-to-end                              |
| Merchant/Rider/Driver mobile app | ❌ Do not exist — see `MERCHANT-RIDER-PACKAGING.md` and DPX-CORE-001's Phase D-2 section                  |
