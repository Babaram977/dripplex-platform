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
2. Add Android app `com.dripplex.app` — Firebase cannot rename a package, so this is a NEW app in the project, and its google-services.json replaces the `GOOGLE_SERVICES_JSON_BASE64` secret
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

> **Corrected 2026-08-26 (DPX-MOBILE-001).** This section previously listed four
> channels — `orders`, `delivery`, `promotions`, `account`. **None of them were ever
> created**, in the native layer or anywhere else. They were a plan, recorded in a
> table that read as a description. What follows is what the code does.

Exactly one channel exists.

| Channel ID                | Name          | Created by                           | Named on the message by                   |
| ------------------------- | ------------- | ------------------------------------ | ----------------------------------------- |
| `dripplex_ride_alerts_v1` | Ride requests | `ensureRideAlertChannel` (super-app) | `FirebasePushProvider` for `RIDE_OFFERED` |

The id is defined once, in `@dripplex/types`
(`RIDE_ALERT_ANDROID_CHANNEL_ID`), and imported by both sides. That is not
tidiness: FCM does **not** error on a channel the app has not created — it falls
back to its own channel, and the alert arrives silent and low-importance, which is
indistinguishable from the bug this channel exists to fix.

Settings: importance 5 (interrupts, heads-up), vibration on, lock-screen visible.
`@capacitor/push-notifications` defaults `vibration` to **false**, so it is set
explicitly; and `android.permission.VIBRATE` is declared in the manifest, because
the system vibrates on the app's behalf and checks that permission first.

**A channel's settings are fixed at creation.** Re-creating an existing channel is a
no-op and the settings belong to the user from then on. Changing how a ride alert
sounds means a _new_ channel id and deleting the old one — hence `_v1`.

Anything not in that table sends no channel and lands on FCM's fallback. Adding one
means creating it client-side **and** mapping the type in
`ANDROID_CHANNEL_BY_TYPE`; either half alone does nothing.

### Gap — no distinctive ride-alert sound

The app ships no audio in `res/raw`, so the channel takes the **system default
notification sound**. That is a real sound, and with importance 5 and vibration the
alert is audible — but a ride offer sounds exactly like every other notification on
the handset.

A recognisable DrippleX ride tone is an asset decision (choose it, licence it, ship
it at each density, register it as `sound` on a **new** channel id since the current
one is already fixed on devices). Recorded here rather than invented.

## Deep linking from notifications

Payload `data.url` → open `https://app.dripplex.com/...` or `dripplex://open/...` (configured in manifests).

## Status

## iOS push — why it had never worked, and what was done (2026-09-18)

Three faults, none visible from a build. Every one of these states compiles,
archives and passes App Store validation; they fail only on a real device, and
silently.

1. **`AppDelegate` implemented neither remote-notification callback.**
   Capacitor's `PushNotifications` plugin does not implement the UIApplication
   delegate methods — it listens for them on `NotificationCenter` and relies on
   the host app to forward them. With neither present, `register()` reached
   APNs, APNs answered, and the answer went nowhere: `registration` never
   fired, `registrationError` never fired, and `obtainNativeTokenDetailed`
   resolved **`timeout`**. It read like a network problem.
2. **No Firebase SDK on iOS.** No pod, no `GoogleService-Info.plist`.
3. **The backend speaks FCM.** `FirebasePushProvider` sends via
   `firebase-admin`, and `DeviceToken` stores what its own comment calls
   "classic FCM registration tokens". So forwarding a raw APNs token would have
   been worse than forwarding none — FCM rejects it, and the provider's error
   handling **deactivates** a device whose token FCM rejects.

Fixed by adding the `FirebaseMessaging` pod and the two callbacks, handing the
APNs token to `Messaging.messaging().apnsToken`, and forwarding the **FCM**
token that comes back.

`FirebaseApp.configure()` is called only when the plist is actually bundled: it
traps when the file is missing, and the plist is gitignored, so an unguarded
call would turn a forgotten config file into a crash on launch for every user.
Without it, push reports a registration error — which is the honest outcome.

**What a Mac still has to do**, because none of it can be done from CI or from
this repository:

1. Download `GoogleService-Info.plist` from Firebase (Project settings → Your
   apps → the iOS app `com.dripplex.customer`) into
   `ios/App/App/`, and **add it to the App target in Xcode**. Copying it into
   the folder is not enough — a file that is not a target member is not in the
   bundle, and Firebase will not configure.
2. `pod install` in `ios/App`, which resolves FirebaseMessaging and updates
   `Podfile.lock`. That lockfile can only be produced on a Mac.
3. Archive, upload, and test on a device through TestFlight.

**The check that says it worked:** the token the app registers should be an FCM
token, not an APNs one. An APNs device token is 64 hex characters; an FCM token
is much longer and contains `:` and `-`. If what reaches
`POST /customer/devices` is 64 hex characters, the bridge is not working.

## Status

| Component                        | Status                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FCM config template              | ✅ `google-services.json.example`                                                                                                                                                                                                                                                                                                                                                  |
| APNS entitlements                | ✅                                                                                                                                                                                                                                                                                                                                                                                 |
| Plugin dependency                | ✅                                                                                                                                                                                                                                                                                                                                                                                 |
| Backend device token API         | ✅ DPX-CORE-001 (`CustomerDevicesController`, `DeviceRegistryService`)                                                                                                                                                                                                                                                                                                             |
| Backend push delivery            | ✅ DPX-CORE-001 Phase D (`FirebasePushProvider`, real FCM sends)                                                                                                                                                                                                                                                                                                                   |
| Web Push (VAPID)                 | ✅ DPX-CORE-001 Phase D-2 — wired in customer-web (`usePushRegistration` + `public/sw.js`)                                                                                                                                                                                                                                                                                         |
| Native token registration (call) | ✅ Phase D-2 — `usePushRegistration` calls `@capacitor/push-notifications` when Capacitor-native                                                                                                                                                                                                                                                                                   |
| Native token registration (APK)  | ⏳ DPX-MOBILE-001 — `registerPushDevice` in **super-app**, which is what the APK loads (PR #294, open). The ✅ row above is `customer-web`, a different app on a different domain                                                                                                                                                                                                  |
| Real Android FCM config          | ⚠️ Registered in Firebase project `dripplex-3a92d` as `com.dripplex.customer`, which is **no longer the applicationId** — a new Firebase Android app for `com.dripplex.app` and a replacement `GOOGLE_SERVICES_JSON_BASE64` secret are required before push works again; CI decodes `GOOGLE_SERVICES_JSON_BASE64` into place and fails the build when push would be dead (PR #293) |
| Android ride-alert channel       | ⏳ DPX-MOBILE-001 — `dripplex_ride_alerts_v1`, created at app start and named on every `RIDE_OFFERED` push. No custom sound (see gap above)                                                                                                                                                                                                                                        |
| Ride offer → push                | ✅ DPX-MOBILE-001 (PR #295) — `RIDE_OFFERED` sends on `PUSH` at `CRITICAL` with a TTL from the offer's real expiry                                                                                                                                                                                                                                                                 |
| iOS Firebase SDK + AppDelegate   | ✅ 2026-09-18 — `FirebaseMessaging` pod, `FirebaseApp.configure()` guarded on the plist, and the two remote-notification callbacks that had never existed. Forwards the **FCM** token, not the APNs one. Guarded by `verify-config.mjs`, which CI runs                                                                                                                             |
| Real iOS APNs config             | ⏳ APNs auth key `66J777N99T` uploaded to Firebase (production slot) on 2026-09-18. Still needed: `GoogleService-Info.plist` in the Xcode target, one `pod install` on a Mac, and a TestFlight device test — untested end-to-end                                                                                                                                                   |
| Merchant/Rider/Driver mobile app | ❌ Do not exist — see `MERCHANT-RIDER-PACKAGING.md` and DPX-CORE-001's Phase D-2 section                                                                                                                                                                                                                                                                                           |
