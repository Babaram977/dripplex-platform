# DPX-MOBILE-003 — Driver Background Mode, Floating Ride Presence & Loud Ride Alerts

**Status:** 🟡 **Driver presence BUILT, not yet device-verified.** The audit below stands as written
(with the corrections marked); §7.2's native foreground service now exists — see §0.3. Everything
else in the document — the ride-alert sound asset, the lease-lapse behaviour, the floating-circle
question — is still audit only.
**Date:** 2026-08-26 (presence built 2026-08-27)
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

## §0.3 What was built, 2026-08-27

`DriverPresenceService` — an Android foreground service of type `location` — plus the
`DriverPresence` Capacitor plugin that starts and stops it.

| Piece        | Where                                                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| The service  | `android/app/src/main/java/com/dripplex/customer/DriverPresenceService.java`                                               |
| The plugin   | `.../DriverPresencePlugin.java`                                                                                            |
| The overlay  | `.../DriverPresenceOverlay.java` — the floating circle (SYSTEM_ALERT_WINDOW)                                               |
| Registration | `MainActivity.java` — **before** `super.onCreate()`, or the bridge is already built and the plugin is silently absent      |
| Manifest     | `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `SYSTEM_ALERT_WINDOW`, `<service … foregroundServiceType="location">` |
| JS bridge    | `packages/hooks/src/driver/native-presence.ts`                                                                             |
| App wiring   | `apps/super-app/src/lib/driverPresence.ts`, called from the Go online toggle and from `signOutRequest`                     |

**It reports natively rather than waking the WebView.** This is the load-bearing decision. A
foreground service keeps the process alive, but Chromium still throttles timers in a WebView that is
not visible — so a service that woke JavaScript to do the POST would reintroduce the exact bug it
exists to fix. The service holds the API origin and an access token and posts to
`/driver/rides/availability` itself, every 60s.

60s, not the WebView's 120s: the server drops a driver after 5 minutes, so this leaves room for four
consecutive failures — a tunnel, a dead cell, a backend restart — where 120s allowed one.

The token is held **in memory only**: never written to disk, never logged, dropped when the service
stops, and the service is stopped before sign-out revokes the session. A 401 or 403 from the
availability write stops the service outright, because a presence notification on a dead token tells
the driver they are working when the server cannot hear them.

`START_NOT_STICKY`, deliberately: `START_STICKY` would have Android restart the service after a
process kill with a null intent — no token, no origin — so it would come back as a notification
attached to a service that can never report anything.

**The WebView heartbeat is not removed.** It stays as the foreground path and as the only path on
iOS and the web. Both writing the same coordinates is harmless: the gateway throttles to one write
per driver per five seconds, and the REST write echoes the driver's own availability back unchanged.

### What is NOT verified

**The Java has never run.** This environment has no Android SDK and no handset, so CI proves it
compiles, packages and signs — and nothing else. Every behavioural claim above is a reading of the
platform contract, not an observation.

What the device test has to establish, and nothing else can:

1. The ongoing notification appears when the driver goes online, and disappears on offline and on
   sign-out.
2. `locationUpdatedAt` keeps advancing with the app minimised for 10+ minutes — the whole point.
3. A ride offered while minimised reaches the driver.
4. Battery cost over a realistic shift.
5. It survives the OEM battery managers common in this market, which kill foreground services more
   aggressively than stock Android does.

### Blocker 3 — resolved 2026-08-27: a real floating overlay

**Founder decision: build the literal floating circle**, on top of the ongoing notification rather
than instead of it. So `SYSTEM_ALERT_WINDOW` is now declared, reversing §9's "explicitly not
adding" — that line was written when the notification was the only presence indicator on the table.

Android's own permission-free bubble API was checked first and does not fit: `Notification`
bubbles need **API 30+** with a sharing shortcut and a conversation-style notification, and this app
is `minSdk 23`. Most handsets in the launch market would get nothing at all.

`SYSTEM_ALERT_WINDOW` is a **special** permission and this shapes the whole design: there is no
runtime dialog for it. The app can only call `Settings.canDrawOverlays()` and send the driver to
`ACTION_MANAGE_OVERLAY_PERMISSION`, where they toggle it by hand — and they may simply walk back
without granting it. So:

- **Nothing in the online path consults it.** Presence starts, reports and shows its notification
  whether or not the bubble can appear. A driver who declines the overlay has a fully working
  shift; asserted in `driverPresence.test.ts`.
- **"Settings opened" is never reported as "granted".** The outcome happens in another app, so
  callers must re-check on resume. Also asserted.
- `DriverPresenceOverlay.show()` returns false rather than throwing when the permission is absent,
  and the service ignores the result.

The bubble is a 56dp circle, dragged to reposition and tapped to open the app. Drag and tap are
told apart by **distance, not timing**: a tap that wanders a few pixels is still a tap, and timing
alone would open the app every time a driver nudged the circle out of the way. It is added with
`FLAG_NOT_FOCUSABLE | FLAG_NOT_TOUCH_MODAL` so it can never eat keystrokes or taps meant for the
app underneath, and `TYPE_APPLICATION_OVERLAY` on API 26+ falling back to `TYPE_PHONE` below it.

It is removed **first** in `stopPresence()`. A bubble that outlives the shift floats over every
other app claiming the driver is online, and the only way to be rid of it is to kill DrippleX.

**Not built:** showing the ride offer itself inside the bubble. Offers currently reach the app
through FCM and the WebSocket in the WebView; putting one in the circle means routing that to
native code, which is its own piece of work. The bubble today is presence, not dispatch.

**Play policy:** `SYSTEM_ALERT_WINDOW` is a normal declaration with no Console form attached — it
is not in the class of `MANAGE_EXTERNAL_STORAGE` or `QUERY_ALL_PACKAGES`. It is granted per-user in
Settings and is standard for this app category.

### Device test, 2026-08-27 — the first run on hardware, and it failed

The APK was installed and the founder reported two things: **no floating icon**, and **minimising
still closes the app**. Both have one cause, and it is not in the Java.

**`DriverPresence` was never reachable from JavaScript.** `native-presence.ts` resolved the plugin
by reading `Capacitor.Plugins['DriverPresence']`, which is always `undefined`:

- `Capacitor.Plugins` is written in exactly one place — `Plugins[pluginName] = proxy` inside
  `registerPlugin` (`@capacitor/core` 7.6.8, `dist/index.cjs.js:178`).
- The Android bridge does not touch it. `JSExport.java:91` injects
  `window.Capacitor.PluginHeaders` and nothing else.
- Nothing in this repo called `registerPlugin('DriverPresence')`.

`@capacitor/push-notifications` works because that package registers itself. A plugin declared only
in `MainActivity.registerPlugin(...)` has a native half and no JavaScript half until the app asks
for one.

So `startDriverPresence()` returned before touching the platform, and every claim in §0.3 about
runtime behaviour was untested in a stronger sense than that section admitted: the Java did not
merely go unobserved, it was never invoked. What the driver actually got:

1. **No bubble** — `overlay.show()` is at `DriverPresenceService.java:163`, inside a service that
   never started.
2. **The app dies when minimised** — the foreground service is the only thing that would have kept
   the process alive.
3. **The original bug was never fixed.** No native heartbeat ran, so a minimised driver still went
   invisible to dispatch after ~4 minutes. This is the failure DPX-MOBILE-003 exists to remove, and
   it was silently still present in a build that claimed to fix it.

**Why nothing caught it.** Two reasons, both worth keeping in mind for the next native plugin:

- `resolvePlugin` had no test. `apps/super-app/src/lib/driverPresence.test.ts` mocks
  `@dripplex/hooks/driver/native-presence` wholesale, so it exercises the wiring above the bug and
  never the bug. The claims "asserted in `driverPresence.test.ts`" above are true of what those
  tests cover and say nothing about whether the plugin resolves.
- The failure reported itself as **`not-android`** — on an Android phone. Anyone reading that
  outcome, including whoever wrote it, would conclude "expected, this is the web or iOS path".

**Fixed:** `resolvePlugin` now calls `registerPlugin('DriverPresence')`, gated on
`Capacitor.isPluginAvailable` so a shell built before the plugin existed degrades to the WebView
heartbeat rather than getting a proxy that rejects. A missing plugin on Android now reports
`no-plugin`, distinct from `not-android`. `native-presence.spec.ts` covers it with a mock whose
`Capacitor.Plugins` is empty, as the bridge leaves it — 10 of its 16 tests fail against the
implementation that shipped.

### Second gap, same test: nothing ever asked for the overlay permission

Independent of the above, and it would have kept the bubble off the screen even with the service
running. `hasOverlayPermission` and `requestOverlayPermission` were built, exported from
`driverPresence.ts` — and imported by nobody. `SYSTEM_ALERT_WINDOW` has no runtime dialog, so an app
that never offers the prompt can never have it granted; the driver would have had to find
"Display over other apps" in Settings unaided.

The line above — "callers must re-check on resume. Also asserted" — described a contract with no
caller on either side of it. It is true now: `driverScreen.tsx` offers the prompt once presence is
running and the permission is absent, and re-checks on `visibilitychange`, which is the only signal
available when the driver flips a toggle in another app and walks back.

**Also fixed:** the outcome of `startDriverPresence` is no longer discarded with a bare `void`. It
is rendered next to the push-health line, so a shift that quietly lost its native service says so
on the driver's own screen instead of looking live.

**Still not verified:** items 2-5 of the device-test list above. This change makes the service
capable of starting; whether it survives a real shift and this market's OEM battery managers is
still an open question that only a handset can answer.

### Still open

Blocker 4 (lease-lapse behaviour) is untouched.

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
>
> This list describes the manifest **as audited**. Since then §0.3 has added `FOREGROUND_SERVICE`,
> `FOREGROUND_SERVICE_LOCATION` and — on the founder's overlay decision — `SYSTEM_ALERT_WINDOW`.

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
(declaration + correct type) · `VIBRATE` (none, normal permission) · **`SYSTEM_ALERT_WINDOW`**
(see below — added 2026-08-27).

Explicitly **not** adding: **`ACCESS_BACKGROUND_LOCATION`** (see the correction in §7.3 — a foreground service
started from the foreground does not need it), accessibility services, device-admin,
`USE_FULL_SCREEN_INTENT`, `RECEIVE_BOOT_COMPLETED`.

> **Amended 2026-08-27.** This section listed `SYSTEM_ALERT_WINDOW` as explicitly not being added. The
> founder has since chosen a real floating overlay (§0.3), so it **is** declared. Written when the
> ongoing notification was the only presence indicator on the table; the decision changed, not the fact.

**Net Play policy cost of this workstream: a service-type declaration, plus `SYSTEM_ALERT_WINDOW`.** The
latter is an ordinary manifest declaration with no Play Console form attached — unlike
`MANAGE_EXTERNAL_STORAGE` or `QUERY_ALL_PACKAGES` — and is granted per user, by hand, in Settings. The
prominent-disclosure flow and background-location review this section previously budgeted for still do not
apply.

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
