# Push notifications — mobile readiness

Native push is scaffolded; **backend registration endpoints are unchanged** in D4 (no API changes).

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

`@capacitor/push-notifications` is installed. Client registration (to be wired in customer-web or shell):

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

| Component                | Status                            |
| ------------------------ | --------------------------------- |
| FCM config template      | ✅ `google-services.json.example` |
| APNS entitlements        | ✅                                |
| Plugin dependency        | ✅                                |
| Backend device token API | ❌ Out of scope D4                |
| Web Push (VAPID)         | ❌ Not in D4                      |
