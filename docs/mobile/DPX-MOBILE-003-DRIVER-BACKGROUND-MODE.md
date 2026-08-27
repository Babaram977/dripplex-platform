# DPX-MOBILE-003 — Driver Background Mode, Floating Ride Presence & Loud Ride Alerts

**Status:** AUDIT ONLY — no implementation. Nothing in this document has been built.
**Date:** 2026-08-26
**Baseline audited:** `main` at `acb844e` (includes #293, #294, #295; excludes #296, which is open).

> **Correction, 2026-08-27.** §7.3 asserted that a location foreground service requires
> `ACCESS_BACKGROUND_LOCATION`, and built §4.2, §8 blocker 2 and §9 on top of that. **It does not.** The
> permission is needed to read location with no foreground service, or to _start_ one from the background —
> neither of which this workstream does. The Play policy cost of driver background mode is a service-type
> declaration and nothing else. Corrections are marked inline at each of the four places.

---

## §0 — Two things to rule on before anything is built

### §0.1 The document number is already taken

`DPX-MOBILE-003` already exists:

| Existing                                        | Path                                                      |
| ----------------------------------------------- | --------------------------------------------------------- |
| DPX-MOBILE-001 — Store Readiness                | `docs/store/DPX-MOBILE-001-STORE-READINESS.md`            |
| DPX-MOBILE-002 — Privacy & Permissions Audit    | `docs/store/DPX-MOBILE-002-PRIVACY-PERMISSIONS-AUDIT.md`  |
| **DPX-MOBILE-003 — Store Privacy Declarations** | `docs/store/DPX-MOBILE-003-STORE-PRIVACY-DECLARATIONS.md` |

And the current workstream has already re-used 001 and 002 for different things under `docs/mobile/`:
DPX-MOBILE-001 is driver ride alerts (#291, #294, #295, #296) and DPX-MOBILE-002 is in-app VoIP calling (#292).

So `DPX-MOBILE-00N` now means two unrelated things depending on the directory. This is not hypothetical:
`AndroidManifest.xml` already cites `docs/store/DPX-MOBILE-002-PRIVACY-PERMISSIONS-AUDIT.md` while #292 calls
itself DPX-MOBILE-002, and a reader following either reference lands somewhere plausible and wrong.

This file uses the number as instructed, and records the collision rather than resolving it unilaterally.
**Founder decision needed.** A suggestion, no more: keep `docs/store/DPX-MOBILE-00N` as-is (it is published
and referenced from the manifest) and renumber the mobile-engineering series to a distinct prefix
(`DPX-DRIVERAPP-001…`). Renaming three unmerged/merged docs is cheap now and expensive later.

### §0.2 The premise about the API level is out of date

The task states _"We are targeting API 36 / Android 16."_ **`main` targets API 35.**

```
apps/customer-mobile/android/variables.gradle
    minSdkVersion    = 23
    compileSdkVersion = 35
    targetSdkVersion  = 35
```

API 36 exists only in **PR #286**, which is open and gated on a physical Android 16 device test that has not
happened. Everything in §10 is written for API 36 because that is where the app is going, but no work here
should assume it has arrived.

`minSdk 23` is the more load-bearing number and is easy to miss: **Android 7 and below have no notification
channels at all**, and they are common in the launch market.

---

## §1 What was audited

Read directly, on `main`, not inferred from prior documents: the rides module (dispatch, gateway, constants,
offer sweep, availability), the notification centre and its FCM provider, the super-app driver screen, sound
library, location heartbeat and socket client, and the whole of `apps/customer-mobile` (manifest, Gradle,
Capacitor config, native sources, plugin list).

Where this contradicts an earlier document, the code is what is reported.

---

## §2 (A) Driver online state

### §2.1 How a driver goes online

`DriverDashboardScreen` (`apps/super-app/src/app/driverScreen.tsx:2472`) holds `online` in React state and
calls `POST /driver/rides/availability` →
`DriverRidesController.setAvailability` (`apps/backend/src/rides/controllers/driver-rides.controller.ts:51`)
→ `RidesService.updateDriverAvailability` (`apps/backend/src/rides/rides.service.ts`).

That upserts a **`DriverAvailability`** row: `online`, `acceptingRides`, `acceptingDeliveries`, `vehicleType`,
`latitude`, `longitude`, `locationUpdatedAt`.

Going online is gated on identity verification and on commission standing — a driver over their credit limit
is refused (`rides.service.ts:703-723`).

### §2.2 The finding that explains the whole complaint

**`DriverAvailability.online` has no TTL, no lease, and no expiry. Nothing on the server ever sets it back to
`false` because time passed.**

An exhaustive search for `online: false` in the backend returns exactly two writers, neither of them a timeout:
`prisma-delivery.repository.ts:497` and `driver-identity-verification.service.ts:539`. There is no sweep
service that expires an online driver — the sweeps that exist are for ride offers, deliveries, orders,
bookings, promotions, shifts and utilities.

**Dispatchability is a different thing from being online**, and that distinction is the bug:

```
apps/backend/src/rides/ride.constants.ts:197
export const DRIVER_LOCATION_MAX_AGE_MS = 5 * 60_000;

apps/backend/src/rides/ride-dispatch.service.ts:326,339
const freshSince = new Date(Date.now() - DRIVER_LOCATION_MAX_AGE_MS);
  ... locationUpdatedAt: { gte: freshSince },
```

`findNearestEligibleDriver` requires a position **no older than five minutes**. So a driver whose app has
stopped reporting is skipped by dispatch **while their row still says `online: true` and their screen still
says "You are live"**.

That is precisely the reported failure — _"when the driver minimizes DrippleX, the driver can effectively go
offline"_. They do not go offline. They go **invisible**, and the app keeps telling them they are working.

### §2.3 Why minimising causes it

The heartbeat is a `setInterval` inside the WebView:

```
apps/super-app/src/lib/locationHeartbeat.ts:17
export const LOCATION_HEARTBEAT_MS = 2 * 60_000;
```

Two minutes, chosen so one missed tick still lands inside the five-minute window. It runs in
`useLocationHeartbeat`, a React effect, and takes a fix via `navigator.geolocation`.

When Android backgrounds the app, **JavaScript timers in the WebView are throttled and eventually frozen**,
and `navigator.geolocation` stops delivering to a backgrounded WebView. Two missed ticks — about four to five
minutes minimised — and the driver drops out of dispatch. There is no native component keeping anything alive,
because there is no native component at all (§4).

The header comment in that file already describes this failure mode for a different cause ("Lawan is online but
no order matches him"); backgrounding is the same failure with a different trigger.

### §2.4 Heartbeat summary

|                                    |                                                             |
| ---------------------------------- | ----------------------------------------------------------- |
| Idle-online cadence                | 120 s (`LOCATION_HEARTBEAT_MS`)                             |
| In-trip cadence                    | 15 s (`DRIVER_TRIP_PING_MS`, `useDriverLocationPing.ts:39`) |
| Server staleness cut-off           | 300 s (`DRIVER_LOCATION_MAX_AGE_MS`)                        |
| Server-side gateway write throttle | 1 write / 5 s / driver                                      |
| Server-side online lease/TTL       | **none**                                                    |
| Auto-offline on heartbeat expiry   | **none**                                                    |
| Survives backgrounding             | **no**                                                      |

In-trip reporting uses two channels deliberately (`useDriverLocationPing.ts`): the `driver:location` socket
message _and_ the REST availability write, so a dropped socket cannot strand a driver behind the 50 m
start-ride proximity gate. Idle-online reporting uses REST only.

---

## §3 (B) Ride offers

### §3.1 How an offer is created

`RideDispatchService.offerToNextDriver` picks the nearest eligible driver, writes a `RideOffer` row with
`expiresAt = now + RIDE_OFFER_TIMEOUT_MS` (**60 s**, `ride.constants.ts:108`), then:

```
apps/backend/src/rides/ride-dispatch.service.ts:136
this.events.publishToDriver(candidate.driverId, 'ride:offered', { rideId: ride.id });

apps/backend/src/rides/ride-dispatch.service.ts:149
await this.eventBus.emit(DOMAIN_EVENTS.RIDE_OFFERED, { ... });
```

`RideOfferSweepService` runs every **5 s** (`RIDE_OFFER_SWEEP_INTERVAL_MS`), expiring stale offers and
re-dispatching.

### §3.2 How the driver actually receives it today — three channels, and the one that ships is a poll

| Channel                   | Status                                                        | Reaches a backgrounded app? |
| ------------------------- | ------------------------------------------------------------- | --------------------------- |
| Socket `ride:offered`     | Live, but **the super-app never subscribes to it** for offers | No — WebView frozen         |
| **REST poll every 5 s**   | **This is what the shipping app uses**                        | **No — timer frozen**       |
| FCM push (`RIDE_OFFERED`) | Live since #295                                               | **Yes**                     |

The driver dashboard polls (`driverScreen.tsx:2549-2591`):

```ts
const iv = setInterval(poll, 5000); // api.driverRides.getOffers()
```

So the primary delivery mechanism for a ride offer in production **is** a 5-second poll from a WebView timer —
exactly what the task says must not be the background mechanism. It is not a fallback; it is the path.

> **Stale comment worth fixing.** That loop's comment says _"an offer lives for 15s"_. The constant is **60 s**.
> Nothing breaks, but it misleads anyone reasoning about repeat-chime behaviour.

### §3.3 Notification centre and FCM — more exists than expected

|                             |                                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| Notification centre         | ✅ `NotificationCenterSubscriber`, preferences keyed on (channel, type)                        |
| `FirebasePushProvider`      | ✅ Real FCM sends, multi-device fan-out, auto-deactivates dead tokens                          |
| Device token storage        | ✅ `DeviceToken` / `DeviceRegistryService`, idempotent                                         |
| Super-app registers a token | ✅ **since #294 (merged today)** — `registerPushDevice`, after sign-in                         |
| `RIDE_OFFERED` → PUSH       | ✅ **since #295 (merged today)** — CRITICAL, `priority: high`, TTL from real expiry            |
| `google-services.json`      | ✅ Supplied by CI from `GOOGLE_SERVICES_JSON_BASE64` (#293); build fails if push would be dead |
| Firebase project            | ✅ `dripplex-3a92d`, Android app `com.dripplex.customer`                                       |
| High-importance channel     | ⏳ **#296, open**                                                                              |

**So the FCM path to a backgrounded phone is already built and is not a blocker.** What does not exist is
anything that keeps the driver _dispatchable_ while backgrounded — an offer can only be pushed to a driver
dispatch is still willing to select (§2.2).

This is the ordering that matters for planning: **fixing the alert without fixing the heartbeat fixes nothing**,
because after ~5 minutes minimised the driver is no longer a dispatch candidate and no offer is ever generated
for them to be alerted about.

### §3.4 Why the alert is "too quiet" — the actual cause

The in-app alarm is a **synthesised Web Audio tone**, not a ringtone:

```
apps/super-app/src/lib/sound.ts:300-311
const RIDE_ALARM_INTERVAL_MS = 1_500;
const RIDE_ALARM_VOLUME      = 0.5;              // vs 0.22 for every other event
const RIDE_ALARM_VIBRATION   = [400, 200, 400];
```

Three reasons it is quiet in a moving car, all structural rather than a volume setting:

1. **It plays on the media stream, not the notification/ringer stream.** A driver with media volume low — or
   navigation audio ducking it — hears little. Android gives no way for a WebView page to route to the ringer
   stream.
2. **It is a sine-ish two-tone chime**, deliberately synthesised to avoid shipping binary assets
   (documented at `sound.ts:8-15`). Tones like these carry poorly against road and engine noise; real ringtones
   are broadband and heavily compressed for exactly this reason.
3. **`navigator.vibrate` has never worked.** The Android WebView Vibration API requires the app to hold
   `android.permission.VIBRATE`, and **the manifest does not declare it** (§4.2). So the buzz-pause-buzz
   intended to reach a pocketed phone has silently done nothing on every build shipped so far. #296 adds the
   permission; that alone will make the _existing_ in-app vibration start working.

And the alarm only rings at all if the WebView is alive and foregrounded, which is the case the complaint is
about.

---

## §4 (C) Native Android

### §4.1 There is effectively no native layer

```java
// apps/customer-mobile/android/app/src/main/java/com/dripplex/customer/MainActivity.java
package com.dripplex.customer;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {}
```

That is the entire native source of the application. There is no service, no receiver, no custom plugin.

Installed Capacitor plugins — the complete list:

`@capacitor/android` · `@capacitor/app` · `@capacitor/core` · `@capacitor/ios` ·
`@capacitor/push-notifications` · `@capacitor/splash-screen` · `@capacitor/status-bar`

**No geolocation plugin** (location is `navigator.geolocation` bridged by Capacitor's
`BridgeWebChromeClient`), **no local-notifications plugin**, **no background-runner**, **no foreground-service
capability of any kind.**

The app is a remote-URL shell: `capacitor.config.ts` points `server.url` at `https://app.dripplex.com`.

> **Consequence for release planning.** Super-app changes ship by **web deploy**, with no Play review. Only
> native changes need a new AAB. Of this workstream, `google-services.json` and the `VIBRATE` permission are
> native; push registration and channel creation are web.

### §4.2 Manifest

Declared: `INTERNET`, `POST_NOTIFICATIONS`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`.
(#296 adds `VIBRATE`.)

**Not declared:** `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`,
`SYSTEM_ALERT_WINDOW`, `WAKE_LOCK`, `RECEIVE_BOOT_COMPLETED`.

> **Corrected 2026-08-27.** This list originally read "and all required for the proposed work". Only
> `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_LOCATION` are required — see the correction in §7.3.
> `ACCESS_BACKGROUND_LOCATION` and `RECEIVE_BOOT_COMPLETED` are not needed and are not being added;
> `SYSTEM_ALERT_WINDOW` was never assumed (§5).

There are **no `<service>` declarations** of any kind, and **no notification channels** are created anywhere on
`main` (#296 creates the first one). App Links for `app.dripplex.com` and the `dripplex://open` scheme are
configured and working.

`ACCESS_BACKGROUND_LOCATION` is called out in the manifest's own comment as deliberately absent because it
would trigger a Play policy review the app would fail _for a capability it does not have_. **That comment
stands and this workstream does not change it** — the foreground service gives the app the capability without
the permission (§7.3).

### §4.3 `POST_NOTIFICATIONS`

Declared, and now genuinely requested at runtime: `obtainNativeToken` calls Capacitor's `requestPermissions()`
(`packages/hooks/src/notifications/native-push.ts:100`), reached from `registerPushDevice` after sign-in
(#294). The task's premise that there is "no proper runtime request" was true before #294 merged today.

**What is still missing is the rationale screen** — the prompt appears cold, with no explanation, and a driver
who declines it cannot be re-prompted by the OS. That remains open from DPX-MOBILE-001.

---

## §5 (D) The floating presence — which Android mechanism

The screenshot shows small circular launchers pinned over another app. Four candidate mechanisms:

| Mechanism                                      | Verdict                                                                                                                                                                                                                                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Foreground-service notification**            | **Recommended.** Required anyway to keep the heartbeat alive (§7.2), so the persistent "DrippleX — Online" presence costs nothing extra. Ongoing, non-dismissible, tappable straight into the app. No special permission, no Play review question.                                 |
| **Heads-up notification (full-screen intent)** | **Recommended for the offer itself**, alongside the channel. This is the loud interrupt. `USE_FULL_SCREEN_INTENT` is restricted on Android 14+ to calling and alarms and would likely be rejected for ride offers — a high-importance channel gets the heads-up banner without it. |
| **Notification bubbles**                       | **Not recommended.** Bubbles are designed for and effectively limited to conversation-style notifications with a shortcut and person; they are user-dismissible per app, unreliable across OEMs, and a ride offer is not a conversation.                                           |
| **Overlay window (`SYSTEM_ALERT_WINDOW`)**     | **Not recommended, and not needed.** This is what the screenshot literally shows, but it needs a special user-granted permission through a Settings screen, is a well-known Play policy flashpoint, and is aggressively restricted by Chinese OEM skins common in this market.     |

**Recommendation: do not request `SYSTEM_ALERT_WINDOW`.** A foreground-service notification plus a
high-importance channel reproduces the _behaviour_ the founder asked for — visibly online, reachable,
one tap back into the ride — without the permission, the Settings detour, or the policy risk. As the task
requires, this is flagged rather than added silently.

The one thing it does not reproduce is a _draggable circle floating over other apps_. If that specific visual
is required rather than the behaviour, that is a separate founder decision with the Play consequences above.

---

## §6 Root causes

| Reported                               | Actual cause                                                                                                                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ride alert too quiet                   | Synthesised Web Audio tone on the media stream (§3.4); `navigator.vibrate` dead for want of `VIBRATE` (§4.2); no notification channel until #296                                 |
| Driver goes offline when minimised     | Driver does **not** go offline — the WebView heartbeat freezes, `locationUpdatedAt` ages past 5 minutes, dispatch skips them while the UI still says "You are live" (§2.2, §2.3) |
| Wants DrippleX available in background | No native layer exists at all (§4.1); offers are delivered by a 5-second WebView poll (§3.2)                                                                                     |

---

## §7 Proposed architecture — **not built, for approval**

### §7.1 Server-side: make `online` mean something

Today `online` is sticky forever and dispatchability is inferred from location age. Proposal: keep the server
authoritative by giving the online session an explicit **lease** — a heartbeat that renews it and an expiry that
ends it — so that "online" and "dispatchable" stop disagreeing, and so the driver's own screen can tell them the
truth. This is a backend change with a migration and is the part that makes everything else honest.

Deliberately not designed further here: it needs a founder decision on what a driver sees when their lease
lapses, and inventing that is out of scope for an audit.

### §7.2 A native foreground service

A custom Capacitor plugin (Java/Kotlin — none of the installed plugins can do this) starting a foreground
service of type `location` when the driver goes online, stopping on offline/logout, holding the heartbeat
natively so it survives backgrounding.

Its ongoing notification **is** the floating presence of §5.

### §7.3 The permission cost — corrected

> **Corrected 2026-08-27.** This section originally said a location foreground service requires
> `ACCESS_BACKGROUND_LOCATION`, and called that "the single largest Play policy item in this workstream". **That
> is wrong**, and the correction removes the workstream's biggest blocker rather than adding one. Verified
> against Android's foreground-service and location documentation. What follows replaces it.

A foreground service of type `location` requires:

| Permission                                        | Cost                                                          |
| ------------------------------------------------- | ------------------------------------------------------------- |
| `FOREGROUND_SERVICE`                              | Normal permission, granted at install. None.                  |
| `FOREGROUND_SERVICE_LOCATION` (Android 14+)       | Declaration plus the correct `android:foregroundServiceType`. |
| `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` | **Already declared and already requested.**                   |

**`ACCESS_BACKGROUND_LOCATION` is not among them.** A foreground service _is_ the sanctioned mechanism for
continuing to receive location while the app is backgrounded — that is what the service is for. The
background-location permission covers something different: reading location with no foreground service at all,
and **starting** a location foreground service _from the background_.

DrippleX starts the service when the driver taps "Go online", with the app in the foreground and on screen. So
the manifest's existing comment stands and nothing about it needs revisiting: `ACCESS_BACKGROUND_LOCATION`
remains deliberately absent, and no prominent-disclosure flow, Data Safety change for background location, or
policy review is triggered by this workstream.

**The one thing that would change that** is auto-restarting the service on device boot
(`RECEIVE_BOOT_COMPLETED`), which starts a location foreground service from the background and does need the
permission. That is out of scope: a driver who reboots their handset can tap Go online again.

**So this is no longer a STOP point, and blocker #2 in §8 is withdrawn.** The founder decisions this workstream
actually waits on are #3 (behaviour vs. a literal floating circle) and #4 (lease-lapse behaviour).

### §7.4 Role gating

One APK serves every role. The service must start **only** when the authenticated user holds the driver role
**and** has deliberately gone online, and must never start for a customer or merchant session.

---

## §8 Blockers and decisions needed

| #     | Item                                                                                                                                                                       | Type               |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1     | `DPX-MOBILE-003` number collision (§0.1)                                                                                                                                   | Founder            |
| ~~2~~ | ~~`ACCESS_BACKGROUND_LOCATION` + prominent disclosure + Data Safety~~ — **withdrawn 2026-08-27**: not required for a foreground service started from the foreground (§7.3) | ~~Founder / Play~~ |
| 3     | Behaviour vs. literal floating circle — `SYSTEM_ALERT_WINDOW` or not (§5)                                                                                                  | Founder            |
| 4     | What a driver sees when their online lease lapses (§7.1)                                                                                                                   | Founder / product  |
| 5     | A real ride-alert sound asset — none exists; `res/raw` is empty (§3.4)                                                                                                     | Founder / design   |
| 6     | No approved Figma design for a minimised/background state (§12)                                                                                                            | Design             |
| 7     | API 36 not on `main`; #286 gated on a device test (§0.2)                                                                                                                   | Engineering        |
| 8     | Physical Android 16 device for acceptance — cannot be done from CI                                                                                                         | Founder            |

**Not a blocker:** Firebase. `dripplex-3a92d` is provisioned, `com.dripplex.customer` is registered, CI supplies
`google-services.json`, and the backend sends real pushes. The task's contingency about `FIREBASE_PROJECT_ID`
does not apply.

---

## §9 Play policy summary

Adding, and their cost: `FOREGROUND_SERVICE` (none, normal permission) · `FOREGROUND_SERVICE_LOCATION`
(declaration + correct type) · `VIBRATE` (none, normal permission).

Explicitly **not** adding: **`ACCESS_BACKGROUND_LOCATION`** (see the correction in §7.3 — a foreground service
started from the foreground does not need it), `SYSTEM_ALERT_WINDOW`, accessibility services, device-admin,
`USE_FULL_SCREEN_INTENT`, `RECEIVE_BOOT_COMPLETED`.

**Net Play policy cost of this workstream: none beyond a service-type declaration.** The prominent-disclosure
flow and background-location review this section previously budgeted for do not apply.

`docs/store/DPX-MOBILE-003-STORE-PRIVACY-DECLARATIONS.md` still needs a look: the app will collect location
while the driver is online, which is a Data Safety statement even without background-location permission.

---

## §10 Android 16 (API 36) considerations

Foreground-service types are enforced, not advisory. Android 15+ restricts starting foreground services from
the background. Notification permission is runtime. Background activity launch is restricted — which is
another reason the offer must be a _notification the driver taps_, not an activity the app launches at them.
Edge-to-edge is enforced and is #286's open device-test risk.

---

## §11 Testing matrix

The seventeen states listed in the task, plus one distinction that must be stated plainly rather than
promised around:

**A user force-stopping the app stops everything, and no amount of native work changes that.** Android
deliberately prevents a force-stopped app from restarting itself. `RECEIVE_BOOT_COMPLETED` restores after a
_reboot_, not after a force-stop. Any plan claiming otherwise is wrong, and drivers should be told the truth
in the UI instead.

Acceptance requires a **physical Android 16 device**. CI can prove none of it.

---

## §12 Figma

Figma MCP connected and verified (`whoami` → `SaeedDanwakili`, Pro). The production Super App file
(`rsHHFRxHVE3OKv81p7m3K1`) is a **Figma Make** file, so `get_design_context` / `search_design_system` /
`get_metadata` all refuse it — _"This tool is not supported for Make files. Supported file type: Design."_
That is a tooling limit, not an absent design.

The repo's own reconciliation of that file (`docs/reference/dpx-100-figma-screen-mapping.md:270-287`) lists all
13 Driver App screens: Splash/Login/OTP (resolved N/A), KYC Status, Upload Docs, Vehicle Registration, Driver
Dashboard, Incoming Request, Nav to Pickup, Verify Passenger, Trip In Progress, Trip Completed, Driver Settings.

**There is no minimised state, no background state, no OS-notification design and no floating presence among
them.** So there is no approved visual source of truth for the surface this task introduces, and it should not
be invented — logged as blocker 6 and in `docs/reference/DPX-FIGMA-DIFF-REGISTER.md`.
