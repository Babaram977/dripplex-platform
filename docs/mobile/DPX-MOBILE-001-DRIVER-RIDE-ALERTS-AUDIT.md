# DPX-MOBILE-001 — Driver Background Ride Alerts: provisioning audit

**Status:** 🔍 **AUDIT ONLY — no application code changed.**
**Date:** 2026-08-26
**Scope of this document:** establish what exists before anything is built, per the founder's
instruction: _"First audit/provision Firebase for the actual DrippleX driver Android package. Do
not assume an existing Firebase project. Do not modify the application yet."_

**Headline: do not create a Firebase project. One already exists — `dripplex-3a92d`.**

---

## 0. The problem this workstream exists to solve

Drivers report two failures:

1. **The incoming-ride alert is too quiet.** A ride request cannot depend on a WebView playing a
   sound.
2. **The driver app dies when they leave it.** Press Home, lock the phone, or let Android reclaim
   the process, and the web application stops being reachable.

The founder's architecture decision, recorded here as the target:

> Foreground: driver app → WebView → active ride and location.
> Background: native Android → FCM → incoming ride notification → tap → deep-link into the ride.

And explicitly **not**: a keep-alive hack that tries to hold the WebView alive in the background,
or a full-screen intent (Android restricts those to calls and alarms, and Play policy restricts
their use elsewhere).

## 1. Findings

### 1.1 There is no driver Android package

| Question                        | Answer                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Android application ID          | **`com.dripplex.customer`**                                                                                  |
| Debug variant                   | `com.dripplex.customer.debug` (`applicationIdSuffix`)                                                        |
| Flavors                         | `production` / `internal` / `closedBeta` — these change **`versionNameSuffix` only**, not the application ID |
| A `com.dripplex.driver` package | **Does not exist**                                                                                           |
| Android projects in the repo    | **One**: `apps/customer-mobile`                                                                              |

Source: `apps/customer-mobile/android/app/build.gradle:4,7,69-86`.

The APK is a **remote-URL shell**. Per the founder decision of 2026-08-24, recorded in
`apps/customer-mobile/capacitor.config.ts`, it loads the **Super App** at `app.dripplex.com` —
_"the canonical surface for customers, drivers, riders and merchants."_

**Consequence for the design.** One Android app serves all four roles, so Firebase needs **one**
Android app registered, not a driver-specific one — and the ride-request notification channel,
its routing and its deep links must key off the signed-in **role**, not off which app is
installed. A customer must never receive a ride-offer notification.

### 1.2 A Firebase project already exists

`.env.example:61-66` and `apps/customer-web/.env.example:18-23` carry a **fully populated, real**
Firebase web configuration:

| Field                          | Value                                       |
| ------------------------------ | ------------------------------------------- |
| Project ID                     | **`dripplex-3a92d`**                        |
| Project number / FCM sender ID | **`520536680214`**                          |
| Web app ID                     | `1:520536680214:web:6ca4773b35ee5df9b29237` |
| Auth domain                    | `dripplex-3a92d.firebaseapp.com`            |
| VAPID key                      | present                                     |

These are genuine, not placeholders. Compare `android/app/google-services.json.example`, which
uses `000000000000` / `dripplex-customer-placeholder` / `REPLACE_WITH_FIREBASE_SERVER_KEY`. The
web values carry the random suffixes Firebase generates.

**The VAPID key is the decisive evidence: it is issued from Cloud Messaging → Web configuration,
so FCM is already enabled in `dripplex-3a92d`, and a web app is already registered in it.**

The production backend on Railway has `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` and
`FIREBASE_PRIVATE_KEY` set. **Their values could not be read from this session** — the Railway
connection is an OAuth app, which returns variable names with values redacted regardless of role.
So the backend's project is inferred from the client config, not confirmed.

> ### ⚠️ Confirm before building — 30 seconds, no secret required
>
> Firebase Console → `dripplex-3a92d` → Project settings → **Your apps**. Expect a web app
> `1:520536680214:web:…` and **no Android app**.
>
> Then check that Railway's `FIREBASE_PROJECT_ID` reads `dripplex-3a92d`. **If it reads something
> else, two Firebase projects exist**, and we need to know which one holds the device tokens
> before registering anything.

### 1.3 What is genuinely missing

| Component                                    | State                           | Evidence                                             |
| -------------------------------------------- | ------------------------------- | ---------------------------------------------------- |
| `google-services.json`                       | ❌ **Absent** — only `.example` | `find` returns nothing                               |
| Android app registered in Firebase           | ❌ No (implied by the above)    | —                                                    |
| CI injection of the config                   | ❌ No workflow references it    | no `google-services` in `.github/workflows/`         |
| Android push registration in the shipped app | ❌ **None**                     | see §1.4                                             |
| Ride-offer push dispatch                     | ❌ **None**                     | see §1.5                                             |
| Runtime `POST_NOTIFICATIONS` request         | ❌ None found                   | permission is _declared_ at `AndroidManifest.xml:87` |
| Dedicated high-importance ride channel       | ❌ None                         | no channel creation anywhere                         |

The Gradle plugin is applied **conditionally** (`android/app/build.gradle:110-115`):

```
def servicesJSON = file('google-services.json')
if (servicesJSON.text) { apply plugin: 'com.google.gms.google-services' }
else { logger.info("google-services.json not found, google-services plugin not applied. Push Notifications won't work") }
```

So a build **succeeds silently** without push. That is the message the previous Android build
reported, and why this failed quietly rather than loudly.

### 1.4 The shipped app cannot register a device token — even once Firebase is wired

`docs/mobile/PUSH-NOTIFICATIONS.md` records _"Native token registration (call) ✅ … calls
`@capacitor/push-notifications` when Capacitor-native."_

**That is true of `apps/customer-web`, and customer-web is not what ships in the APK.**

`usePushRegistration` is defined in `packages/hooks/src/notifications/` and consumed only by
`apps/customer-web/src/components/pwa/`. That is `www.dripplex.com`. The APK loads
**`apps/super-app`**, which contains no reference to `PushNotifications` at all.

So adding `google-services.json` alone changes nothing observable: the app would still never
obtain or register an FCM token. **This is the single most under-estimated item in the
workstream** — a report doc said done, the code says otherwise.

### 1.5 A ride offer sends no push

`ride_offered` exists as a notification event, but
`apps/backend/src/notifications/production-notification.service.ts:463` produces only an email
subject and body. Nothing in `apps/backend/src/rides/` calls the notification centre.

Even with FCM working end to end and a token registered, a driver would still receive nothing when
a ride is offered, because nothing sends it.

### 1.6 What already works, and is better than expected

| Component                       | State                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend FCM delivery            | ✅ Real. `FirebasePushProvider` binds when credentials resolve (`notification-center.module.ts:51-60`); `notification-center.service.ts:510` dispatches through it |
| Device token API                | ✅ `POST customer/devices` → `DeviceRegistryService.register` (upsert, idempotent per user+platform+token)                                                         |
| Driver permission to register   | ✅ The `driver` role holds `customer:notifications:manage` (`prisma/seed-data/role-permissions.ts`), so the endpoint is reachable despite its customer-ish path    |
| `@capacitor/push-notifications` | ✅ Installed (`^7.0.1`)                                                                                                                                            |
| `POST_NOTIFICATIONS` declared   | ✅ `AndroidManifest.xml:87` — declared, not requested                                                                                                              |
| CI secret-file mechanism        | ✅ Proven pattern, see §2                                                                                                                                          |

### 1.7 Security posture — the founder's rule is already honoured

No FCM server credential exists anywhere in the Android app. Server-side authentication is a
service account held in Railway (`FIREBASE_PRIVATE_KEY`), consumed by
`firebase-admin.factory.ts`. `google-services.json` is a **client** config and is intended to ship
in the app build; the `.example` contains no real key.

**One observation, not a blocker.** The Firebase **web** config — including the browser API key —
is committed to `.env.example` and `apps/customer-web/.env.example`. Firebase's documentation is
explicit that this is not a secret, and the file comments say so correctly. But an unrestricted
Firebase browser key can still be exercised against other enabled APIs in the project, so it is
worth confirming that key is restricted by HTTP referrer in Google Cloud Console.

## 2. How CI will receive `google-services.json`

The mechanism already exists and is proven — `mobile-build.yml:71` does exactly this for the
signing keystore:

```yaml
- run: echo "$ANDROID_KEYSTORE_BASE64" | base64 -d > apps/customer-mobile/android/release.keystore
  env:
    ANDROID_KEYSTORE_BASE64: ${{ secrets.ANDROID_KEYSTORE_BASE64 }}
```

So: a **`GOOGLE_SERVICES_JSON_BASE64`** repository secret, decoded to
`apps/customer-mobile/android/app/google-services.json` **before** the Gradle step in
`scripts/mobile/build-android.sh`.

Two things to get right, because the conditional plugin makes both silent:

- **The file must be written before Gradle runs**, or the plugin is skipped and the build still
  succeeds without push.
- **The build should fail** when the secret is absent on a release track, rather than shipping a
  push-less APK. The workflow already takes this stance for signing (_"an unsigned bundle is a
  failure here, not a warning"_) — the same rule should apply here.

`google-services.json` must stay out of git. It is a client config rather than a secret, but
keeping it in CI matches how the keystore is handled and avoids committing a per-environment file.

## 3. Revised sequence

The founder's sequence, corrected for §1.2 (project exists) and §1.4 (the shipped app has no
registration path):

| #   | Step                                                                                                  | Owner       | Blocked by |
| --- | ----------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| 0   | **Confirm `dripplex-3a92d` in the console, and that Railway's `FIREBASE_PROJECT_ID` matches**         | Founder     | —          |
| 1   | Register **`com.dripplex.customer`** as an Android app in the **existing** project                    | Founder     | 0          |
| 2   | Download `google-services.json`; add `GOOGLE_SERVICES_JSON_BASE64` secret                             | Founder     | 1          |
| 3   | Wire CI to decode it before Gradle, and fail the build when absent                                    | Engineering | 2          |
| 4   | **Add push registration to the super-app** — the missing piece §1.4 found                             | Engineering | 3          |
| 5   | Request `POST_NOTIFICATIONS` at runtime, with a rationale prompt                                      | Engineering | 4          |
| 6   | Register device tokens against the driver account                                                     | Engineering | 4          |
| 7   | Create a dedicated **high-importance** ride-request channel: sound, vibration, lock-screen visibility | Engineering | 3          |
| 8   | Dispatch an FCM push on ride offer, role-targeted                                                     | Engineering | 6          |
| 9   | Deep-link notification → ride request screen                                                          | Engineering | 7          |
| 10  | Test: backgrounded, swiped away, process killed, locked, Android 16, battery restrictions             | Engineering | all        |

Steps 0-2 are founder actions in the Firebase Console. **Nothing in this repository should change
until step 1 is done**, because everything downstream depends on the config file it produces.

## 4. Open questions for the design, not for this audit

Recorded so they are answered deliberately rather than assumed:

- **Duplicate and stale offers.** An offer expires after `RIDE_OFFER_TIMEOUT_MS` (60s). A
  notification outliving its offer must not open a ride that is gone.
- **Acceptance races.** Two drivers tapping the same notification — the existing offer-claim guard
  should settle it, but the notification path has to surface the loss clearly.
- **Role targeting.** One app, four roles. A ride-offer push must reach only the assigned driver.
- **Channel policy.** A driver must be able to turn the alert down without silencing everything
  else, which means more than one channel.
- **Debug package.** `com.dripplex.customer.debug` is a distinct application ID and needs its own
  Firebase Android app if push is to work in debug builds.

## 5. What this document does not do

- It changes no application code, no Gradle file, no manifest, and no workflow.
- It does not create, modify or configure any Firebase project.
- It does not contain any credential. The identifiers in §1.2 are the public client config already
  committed to `.env.example`, and no service-account key is reproduced anywhere.
