# DPX-MOBILE-002 — In-App Voice Calling (design)

**Status:** 🔒 **Architecture approved (founder, 2026-08-26). Stage 1 client built 2026-08-27 —
see §11. Not yet exercised on a device.**
**Date:** 2026-08-26, §11 added 2026-08-27
**Depends on:** `DPX-MOBILE-001` for Stage 2 (background/incoming). Stage 1 does not.

---

## 0. Approved architecture (locked)

**DrippleX calling is in-app VoIP over WebRTC, with LiveKit as the media layer.** This is the
platform's calling architecture, not one option among several.

```
DrippleX Chat → Call button → DrippleX backend authorisation → LiveKit/WebRTC → private voice call
```

Locked with it, as founder decisions:

| Decision                         | Locked position                                                              |
| -------------------------------- | ---------------------------------------------------------------------------- |
| Media transport                  | **WebRTC over LiveKit**                                                      |
| Phone numbers                    | **Never exposed**, to either party                                           |
| Authorisation                    | **Contextual**, through the existing `MessagingService.requireParticipant()` |
| Modality                         | **Voice first**, video later on the same foundation                          |
| Recording                        | **No call recording by default**                                             |
| Retention                        | **Call history and metadata retained — never audio**                         |
| Parties, initially               | **Customer ↔ driver / rider**                                                |
| Background & lock-screen calling | **After DPX-MOBILE-001 FCM is operational**                                  |
| Native Android audio             | **Implemented where required**                                               |
| Android 16                       | **Compatibility is a release requirement**                                   |

**Masked PSTN is rejected as the primary architecture.** It is documented in §0.1 solely as a
contingency should field testing expose serious connectivity problems. It is not an alternative
under consideration, and nothing in this design should be built to accommodate it.

### 0.1 Contingency only — masked PSTN

Recorded so a future reader knows the constraint was understood, not overlooked, and so the
contingency is already scoped if it is ever needed.

VoIP requires working **data on both devices at the moment the call is placed**. A driver in patchy
coverage can sometimes still take a GSM call when a WebRTC session will not establish. That is a
real constraint of the approved architecture, and §4's call record is shaped to measure it in the
field rather than argue about it in advance.

**If** the Kano pilot shows a call-completion rate that makes voice unreliable in practice, masked
PSTN becomes available as a **fallback path alongside** VoIP — never a replacement for it, and
never a reason to defer or dilute the work in this document.

## 1. Scope

**Stage 1 — foreground voice.** Passenger ↔ Driver, Customer ↔ Rider. Both apps open. Call button
in the existing chat. This document specifies Stage 1 in full.

**Stage 2 — background incoming calls.** Deferred. It depends entirely on DPX-MOBILE-001's FCM
work, which is itself blocked on the Firebase Android app being registered. Specifying it now would
be speculative. §8 records what is known.

**Stage 3 — platform-wide (merchant, hotel).** Deferred, and gated on a founder decision — see
§6.4.

## 2. What already exists, and should not be rebuilt

The single most important finding: **the authorisation model calling needs is already written.**

`MessagingService.requireParticipant(userId, contextType, contextId)`
(`apps/backend/src/messaging/messaging.service.ts:163`) resolves the two parties from the ride or
delivery itself and rejects anyone else. Its own comment:

> The whole authorisation model: you may read or write a thread if and only if you are one of the
> two parties on the job it is anchored to. Read fresh every time, so a reassignment takes effect
> immediately.

That is exactly the rule the founder specified for calls — customer ↔ their driver, never customer
→ unrelated driver — including the reassignment property, which matters more for calls than for
chat: a driver swapped off a ride must lose call access instantly.

**`resolveParticipants` must be extracted into something both modules share, not copied.** Two
divergent copies of a permission check is how a customer eventually calls the wrong driver.

| Component                        | State                                                        | Use                     |
| -------------------------------- | ------------------------------------------------------------ | ----------------------- |
| Participant authorisation        | ✅ `MessagingService`                                        | Extract and share       |
| Chat surface for the call button | ✅ `Message` model, ride + delivery contexts                 | Add call affordance     |
| Realtime transport               | ✅ socket.io `rides` namespace, JWT-authenticated on connect | Call signalling         |
| Per-user addressing              | ✅ every socket joins `user:{id}` (`ride.gateway.ts:79`)     | Ring the callee         |
| Audit trail                      | ✅ `AuditService`                                            | Call lifecycle events   |
| Permission convention            | ✅ `messaging:use`                                           | Mirror as `calling:use` |
| LiveKit / WebRTC dependency      | ❌ None in the repo                                          | New                     |
| Microphone permission            | ❌ **Declared nowhere**                                      | See §5                  |

**Signalling needs no new transport.** The `rides` gateway already authenticates on connect and
gives every user a personal room. Call invite, ringing, accept, decline and end are messages on
that socket. Adding a second realtime channel for calling would be a second thing to keep alive,
authenticate and debug.

## 3. Architecture

```
Caller taps 📞 in chat
        │
        ▼
  DrippleX backend ──── authorise (are these two the parties of this live job?)
        │                └── reuse resolveParticipants — do not reimplement
        │
        ├── create Call record (RINGING)
        ├── mint two short-lived LiveKit tokens, one per participant
        └── emit call:incoming → user:{calleeId} on the rides socket
                                          │
                                          ▼
                             Callee sees incoming call screen
                                   accept / decline
                                          │
              ┌───────────────────────────┴──────────────┐
              ▼                                          ▼
      both join LiveKit room                       decline → Call(DECLINED)
      audio flows peer↔SFU                         emit call:ended to caller
      DrippleX never touches media
```

**The division of responsibility is the point.** DrippleX owns _who may call whom, when, and what
happened_. LiveKit owns _moving the audio_. No media, and no signalling of media, passes through
DrippleX.

### 3.1 Token minting

LiveKit access tokens are minted **server-side only**, short-lived, scoped to one room and one
identity, and issued only after the participant check passes.

`LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` are backend environment variables, following the same
rule already applied to the Firebase service account: **no LiveKit secret ever reaches the client
bundle or the APK.** The client receives a token, never a key.

Token TTL should be short enough that a leaked token is useless after the call — minutes, not
hours — and a token must not be re-issuable for a job that has ended.

### 3.2 Room naming and lifetime

One room per call, not per ride: `call-{callId}`. A room keyed on the ride would let a completed
call's token rejoin a later conversation on the same ride.

## 4. Call record

Per the founder's list, and shaped so §7's completion-rate measurement is possible from the
first call:

| Field                       | Notes                                                                        |
| --------------------------- | ---------------------------------------------------------------------------- |
| `id`                        |                                                                              |
| `contextType` / `contextId` | `RIDE` \| `DELIVERY` + the job id — same anchoring as `Message`              |
| `callerId` / `calleeId`     |                                                                              |
| `status`                    | `RINGING \| ANSWERED \| DECLINED \| MISSED \| FAILED \| ENDED`               |
| `startedAt`                 | Invite created                                                               |
| `answeredAt`                | Null when never answered — this is what makes "missed" measurable            |
| `endedAt`                   |                                                                              |
| `durationSeconds`           | Derived from answered→ended, null when unanswered                            |
| `endedReason`               | `CALLER_HANGUP \| CALLEE_HANGUP \| DECLINED \| TIMEOUT \| CONNECTION_FAILED` |

**`FAILED` and `CONNECTION_FAILED` are not cosmetic.** They are how DrippleX learns its own call
reliability on Kano mobile data — which network conditions break a call, and whether the fix is
TURN coverage, codec choice or reconnection handling (§7).

**No audio is recorded.** Founder decision. Recording would bring consent, storage, retention and
NDPA obligations that a coordination call does not justify, and it would have to be disclosed in
the Privacy Policy (`DPX-LEGAL-001` §18) and the Play Data Safety declaration.

## 5. Blockers — none of these exist today

### 5.1 Microphone permission is declared nowhere

**Resolved 2026-08-27** — `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS` and
`NSMicrophoneUsageDescription` are now declared, `verify-config.mjs` fails the build without any of
them, and the store declarations were revised in the same change. The Privacy Policy line and the
Play Console Data safety entry are **still outstanding** — see §11. The original text follows,
because the reasoning is what makes the check worth keeping.

`AndroidManifest.xml` declares `INTERNET`, `POST_NOTIFICATIONS`, `ACCESS_FINE_LOCATION` and
`ACCESS_COARSE_LOCATION`. **There is no `RECORD_AUDIO`.** iOS `Info.plist` has no
`NSMicrophoneUsageDescription`.

Without these, `getUserMedia({ audio: true })` fails on device. Both are required, and both have
consequences beyond the manifest:

- **Google Play Data Safety** must be updated to declare microphone access and why.
- **App Store** requires a purpose string that a reviewer will read.
- `docs/store/DPX-MOBILE-003-STORE-PRIVACY-DECLARATIONS.md` must be revised in the same change.
- The Privacy Policy must say DrippleX processes voice calls between parties to a job.

`RECORD_AUDIO` is a runtime permission on Android. It must be requested **in context** — at the
moment the user taps Call, not at app start — with a clear rationale. A driver who denies it at
launch for no visible reason is a driver who cannot be called.

### 5.2 The WebView must be granted the microphone

**Confirmed against the pinned bridge, 2026-08-27, and it is better than feared.**
`BridgeWebChromeClient.onPermissionRequest` (`@capacitor/android` 7.6.8, lines 102-124) maps
`AUDIO_CAPTURE` to `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS` and **launches the runtime request
itself** — no plugin and no native code of ours. On iOS, `WebViewDelegationHandler` grants the
WKWebView capture request outright (`@capacitor/ios` 7.6.8), which is why the usage string is the
only thing standing between a tap on Call and a terminated process.

So the manifest lines are not merely necessary, they are sufficient. The silent-denial pattern
still holds and is exactly why they matter: Android denies a runtime request for a permission
absent from the manifest instantly, with no prompt at all — the same failure already documented for
geolocation in `DPX-MOBILE-002-PRIVACY-PERMISSIONS-AUDIT.md`.

§5.1's requirement that the permission be asked **in context** falls out of this: the prompt
happens on `getUserMedia`, and the client joins the room on the tap that places or answers the
call, so the driver is asked at the only moment it makes sense to them.

### 5.3 Audio session and routing are native concerns

The JS SDK cannot own these:

- Earpiece vs speaker, and the switch between them.
- Bluetooth headset routing.
- Ducking or pausing other audio.
- Surviving screen-lock mid-call — a driver will lock the phone while talking.
- Interaction with an inbound GSM call, which will interrupt a VoIP call.

**Note on the LiveKit React Native SDK: it does not apply here.** DrippleX is a Capacitor WebView
shell loading a Vite SPA, not React Native. Stage 1 uses `livekit-client` in the WebView; the
audio-session work above is bespoke native code or an existing Capacitor plugin, and it should be
scoped as native work rather than assumed to come free with the SDK.

### 5.4 `Permissions-Policy` — a trap for the portals, not the app

`packages/config/next/security-headers.js:45` sets `microphone=()`, which disables the microphone
entirely for every Next.js portal.

**The super-app is unaffected** — it is a Vite SPA served by `apps/super-app/serve.json`, which
sets no `Permissions-Policy`. Since the APK loads the super-app, Stage 1 is not blocked.

But **any calling surface added to a Next.js portal** (driver-portal, rider-portal, customer-web)
will fail silently until that header is changed to `microphone=(self)`. Recorded because the
failure mode is a `getUserMedia` rejection with no obvious cause.

## 6. Call authorisation rules

### 6.1 When a call may be placed

Only while the job is live and the two parties are actually paired. Concretely, for a ride: a
driver is assigned and the ride has not reached a terminal state. `resolveParticipants` returns
`courierId: null` before assignment, which already denies the call — no extra rule needed.

### 6.2 When call access ends

Terminal ride/delivery states end call access: completed, cancelled by either party or by
Operations, expired. The check is fresh per call attempt, so this needs no scheduled teardown — a
call simply cannot be created once the job is no longer live.

**Grace period is an open question (§9).** A passenger who left a bag in the car needs to reach the
driver _after_ completion. A permanent channel to a stranger is the thing to avoid. A bounded
window after completion is the likely answer, and it is a founder decision.

### 6.3 An in-progress call when the job ends

Operations can cancel a ride mid-trip. The room should be closed and the call ended with a reason,
rather than left running on a job that no longer exists.

### 6.4 Stage 3 needs a schema decision, not a refactor

`MessageContextType` is `DELIVERY | RIDE` only, and the schema comment records that as deliberate:

> Deliberately not a general-purpose inbox: DrippleX has no person-to-person messaging, and
> opening one would let a rider message a…

Merchant and hotel calling means new context types on both chat and calling. That widens a
deliberately narrow model and is a founder decision, not an implementation detail.

## 7. Stage 1 field acceptance

What Stage 1 must demonstrate before Stage 2 begins. These are acceptance criteria for the approved
architecture, not a re-test of the decision.

- A call connects between two real devices on Nigerian mobile data.
- Answer latency is acceptable — ringing to audio.
- Audio routing survives screen-lock, speaker toggle and a Bluetooth headset.
- A GSM call interrupting a VoIP call leaves clean state, not a stuck room.
- **Android 16 compatibility**, per §0's release requirement.
- **Call completion rate** is recorded from §4's `status` and `endedReason` — measured from the
  first day of the pilot, so the platform knows its own reliability rather than guessing at it.

A poor completion rate is a signal to **improve** the VoIP path first — TURN relay coverage, codec
and bitrate choices, reconnection behaviour on a network handover — since most causes of a failed
WebRTC call in the field are fixable within the approved architecture. Only if it remains
unreliable after that work does §0.1's contingency come into play.

## 8. Stage 2 — what is known, deferred

Blocked on DPX-MOBILE-001. Recorded so it is not rediscovered:

- Incoming calls are the one case where Android **does** permit full-screen intents. Done properly
  that means `CallStyle` notifications and, for a call that behaves like a call on the lock screen,
  `ConnectionService` / `TelecomManager`. That is substantial native work in a WebView shell.
- Delivery must be a **high-priority** FCM message; a normal-priority push will be deferred by Doze
  and a ring that arrives after the caller gave up is worse than none.
- A ring has a deadline. An FCM push that arrives after the caller hung up must not ring — the
  payload needs the invite's expiry and the client must check it.
- iOS is a different mechanism entirely: CallKit and PushKit VoIP pushes, with Apple's requirement
  that a VoIP push must report a call to CallKit.

## 9. Open questions for founder decision

1. **Post-completion grace period** (§6.2) — how long may a passenger call the driver after the
   ride ends? Zero is defensible; so is fifteen minutes. It should be chosen, not defaulted.
2. **Who may initiate** — both directions, always? A driver calling a passenger who has not shared
   a number is exactly what this feature is for, but it is also the abuse surface.
3. **Rate limiting and abuse** — repeated calls to a passenger who declined. Needs a cap and a
   report path.
4. **Fallback when the callee has no data** — show "unavailable", or fall back to chat with a
   clear message? Silence is the worst option.
5. **LiveKit deployment** — LiveKit Cloud or self-hosted. Cloud is per-participant-minute and adds
   a vendor dependency on a live ride; self-hosting adds operational burden. Either way it is a new
   runtime dependency in the path of an active trip.
6. **Stage 3 context widening** (§6.4).

## 10. What this document does not do

- It writes no code, adds no dependency, and changes no manifest, header or schema.
- It does not specify Stage 2 beyond what §8 records as known.
- It does not decide the open questions in §9.
- It does not treat the architecture as open. VoIP over LiveKit is locked (§0); §0.1 exists so a
  known constraint is measured rather than forgotten, and carries no implication that the decision
  is provisional.

---

## 11. Stage 1 as built (2026-08-27)

Founder instruction: _"Start the calling option."_ The backend for this shipped earlier — this is
the client, plus the two manifest lines and the store paperwork that go with it. **Nothing in the
backend contract was changed or extended**; every route, socket event and status below was read out
of `CallsController`, `CallsService` and `CallTokenProvider` before a line of client code was
written.

### 11.1 What was added

| Layer     | File                                     | What it is                                                 |
| --------- | ---------------------------------------- | ---------------------------------------------------------- |
| Types     | `packages/types/src/call/index.ts`       | The DTOs and the three socket payloads                     |
| SDK       | `packages/sdk/src/calls/calls-client.ts` | The six routes, on `DripplexClient.calls`                  |
| Super-app | `src/lib/api.ts`                         | The same six, for the app's own fetch layer                |
| Super-app | `src/lib/ws.ts`                          | `onCallIncoming` / `onCallAccepted` / `onCallEnded`        |
| Super-app | `src/lib/callRoom.ts`                    | The LiveKit adapter — the only file that knows about media |
| Super-app | `src/lib/callRequests.ts`                | "Call this person", so any screen can ask                  |
| Super-app | `src/app/callLayer.tsx`                  | The overlay: ringing, in-call, outcome                     |
| Super-app | `src/app/chatScreen.tsx`                 | The call button, beside the conversation                   |
| Android   | `AndroidManifest.xml`                    | `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`                    |
| iOS       | `Info.plist`, `PrivacyInfo.xcprivacy`    | `NSMicrophoneUsageDescription`, Audio Data                 |
| Preflight | `scripts/verify-config.mjs`              | Fails the build if any of the above goes missing           |

### 11.2 Decisions worth knowing about

**DrippleX is authoritative, LiveKit is not.** The overlay closes on `call:ended` or on the
response to its own hang-up — never because the media layer said something. A dropped audio path
calls `POST /calls/:id/end` and _then_ closes, so the other side stops ringing instead of waiting
for the sweep.

**The caller joins the room on the tap, not on the answer.** That puts the microphone prompt inside
a user gesture (§5.1's "in context") and makes the far side audible the instant they accept. Nobody
can hear the empty room: it belongs to one call, and the only other token ever minted for it is the
callee's, on accept.

**Every exit releases the microphone**, including the one that is easy to miss — hanging up while
the connect is still in flight. A generation counter makes the late `joinCallRoom` resolution
abandon its own room. That path has a test, and the test was checked by removing the guard.

**`livekit-client` is lazy-loaded.** Half a megabyte of WebRTC stack, on mobile data, for a session
that will usually contain no call. The main bundle stays at 448 kB gzipped instead of 582 kB, and
the chat screen prefetches the chunk because being on it is the best warning we get.

**A second incoming call while one is in progress is declined automatically** rather than stacking
a ringing screen over a conversation.

### 11.3 Not verified

CI proves this typechecks, lints, tests and builds. **No call has been placed.** Nothing here has
touched a microphone, a LiveKit server or a handset, and everything in §7 remains untested:
connection on Nigerian mobile data, answer latency, routing across screen-lock, speaker and
Bluetooth, and a GSM call interrupting a VoIP one. §5.3 is untouched — audio-session and routing
work is still native work that does not exist.

The first device test also needs a **new AAB**: the app is a remote-URL shell, so the UI reaches a
handset by web deploy, but a manifest permission does not. Calling will fail on the build currently
in internal testing, and it will fail _silently_ — no prompt, no dialog, just a call that does not
connect.

### 11.4 Still open

1. **Incoming calls do not ring a backgrounded app.** `CallsService.initiate` publishes
   `call:incoming` over the socket and nothing else, so the callee learns about it only while the
   app is open. This is §8's Stage 2 and is exactly as designed — but §8's blocker on
   `DPX-MOBILE-001` looks largely spent: the notification centre already maps
   `DOMAIN_EVENTS.RIDE_OFFERED` to `NotificationPriority.CRITICAL`
   (`notification-center.subscriber.ts:195-200`), which is the high-priority path §8 asks for. So
   Stage 2's server half is a contained change — a domain event on `initiate`, a
   `NotificationType` mapping, and the expiry check §8 requires. Not made here: it is backend work
   and a separate feature.

   **One caveat, and it is not small.** That the code path exists is verified; that a push actually
   reaches a backgrounded handset is not — it is still the outstanding 90-second field test from
   the DPX-MOBILE-003 work. If ride offers turn out not to reach a minimised driver, incoming calls
   will not either, and the two share one fix.

2. **The ringing screen cannot say who is calling.** `CallDto` carries `callerId` and no name, so
   the callee sees "Incoming call · About your trip". Adding a display name to the
   `call:incoming` payload is a one-field backend change; guessing one on the client is not
   available, because the callee may hold no record of the other party.
3. **§9's open questions are still open**, and question 1 — the post-completion grace period — is
   the one this makes concrete: `isJobLive` decides it today, so a passenger who leaves a bag in
   the car cannot call about it.
4. **Play Console Data safety** must gain "Audio · Voice or sound recordings" with the build that
   carries `RECORD_AUDIO`, and the Privacy Policy needs the sentence §5.1 asked for. Neither is a
   code change and neither is done.
5. **iOS background audio.** `UIBackgroundModes` has `remote-notification` only. A call will not
   survive backgrounding on iOS without `audio`, which is a Stage 2 concern alongside CallKit.
