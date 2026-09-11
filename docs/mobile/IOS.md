# iOS packaging — Dripplex Customer

| Field                 | Value                   |
| --------------------- | ----------------------- |
| **Bundle ID**         | `com.dripplex.customer` |
| **Display name**      | Dripplex                |
| **Marketing version** | `1.0.0`                 |
| **Build**             | `1000100`               |
| **Min iOS**           | 15.0                    |

## Apple's build-tool floor — Xcode 26, and what it forces

Verified against Apple, 2026-09-11:

| Apple requirement                                                                                                     | Source                                                                                |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Uploads to App Store Connect must be built with **Xcode 26 or later**, using the iOS 26 SDK — since **28 April 2026** | [Upcoming Requirements](https://developer.apple.com/news/upcoming-requirements/)      |
| Xcode 26 runs on **macOS Sequoia 15.6 – macOS Tahoe 26.x**                                                            | [SDK and system requirements](https://developer.apple.com/xcode/system-requirements/) |
| Xcode 26 supports **deployment targets iOS 15–26**                                                                    | same                                                                                  |

The third row was a blocker sitting in the project. `IPHONEOS_DEPLOYMENT_TARGET`
was **14.0** in all four build configurations and `platform :ios, '14.0'` in the
Podfile. Xcode 26 does not accept an iOS 14 deployment target, so the first
archive attempt on the Mac would have failed on configuration — after the Mac
was paid for, which is the worst moment to find it.

Raised to **15.0**, which is the lowest Xcode 26 allows and therefore keeps the
widest device support available to us. Capacitor 7's own floor is
`ios.deployment_target = '14.0'`, so 15.0 clears it.

**This costs no users.** The app is not on the App Store, so there is no
installed iOS base to strand. On Android, which is live, nothing changes.

## Xcode project

Path: `apps/customer-mobile/ios/App/App.xcodeproj`

Open on macOS:

```bash
cd apps/customer-mobile
pnpm exec cap open ios
```

## Signing

1. Apple Developer Program team
2. Create App ID `com.dripplex.customer`
3. Enable **Push Notifications** + **Associated Domains** (`applinks:app.dripplex.com`)
4. Provisioning: Automatic (Xcode) or manual profiles for CI (fastlane match)

`CODE_SIGN_STYLE = Automatic` in project — configure team in Xcode.

## Correction, 2026-09-11 — the entitlements were never applied

The "Verified configuration" table below previously marked Universal Links and
Push as ✅ on the strength of `App.entitlements` existing and containing the
right keys. It does, and it was attached to nothing: neither the Debug nor the
Release build configuration set `CODE_SIGN_ENTITLEMENTS`, and there is no
`.xcconfig` outside Pods that set it either.

A file that exists, reads correctly and is never loaded looks exactly like a
file that works. The same shape of fault put `GEOCODER` at `undefined` in
production for the whole life of the merchant "Find on map" button. Worth
naming, because the table said verified and nothing was.

Both configurations are now wired, and the App Store value is in place.

## Configuration status

Two columns, deliberately. **Present** means the repository contains it and it was
read; **Proven** means something executed it. Nothing in the signing path has
been proven, because no Mac has built this project — see the CI build note below.
The single ✅ column this table used to carry is what let "entitlements exist" be
recorded as "push works".

| Item                   | Present                                              | Proven                                                            |
| ---------------------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| Bundle identifier      | ✅ `com.dripplex.customer`                           | ✅ CI Release compile                                             |
| Launch screen          | ✅ `LaunchScreen.storyboard`                         | ✅ CI Release compile                                             |
| App icons              | ✅ 1024×1024, RGB, **no alpha** — re-read 2026-09-11 | ✅ `verify-icons.mjs`                                             |
| Privacy Manifest       | ✅ `PrivacyInfo.xcprivacy`                           | ⬜ validated at first upload                                      |
| App Transport Security | ✅ HTTPS only (localhost exception)                  | ✅ CI Release compile                                             |
| Non-exempt encryption  | ✅ `ITSAppUsesNonExemptEncryption = false`           | ⬜ validated at first upload                                      |
| Custom URL scheme      | ✅ `dripplex://`                                     | ⬜ needs a device                                                 |
| Deployment target      | ✅ 15.0 — Xcode 26 floor                             | ⬜ needs Xcode 26                                                 |
| **Universal Links**    | ✅ entitlement wired 2026-09-11                      | ⬜ **needs a signed build + the real Team ID in the hosted AASA** |
| **Push (APNs)**        | ✅ `UIBackgroundModes` + entitlement (`production`)  | ⬜ **needs a signed build + an APNs key**                         |

The app icon was re-read on 2026-09-11 rather than trusted: single-size
`universal` 1024×1024 entry, PNG colour type 2 (RGB, no alpha channel). Apple
rejects icons with alpha, so that one is genuinely settled.

## App Store enrolment — parked until after the driver dinner

Founder decision 2026-08-28: not now, revisit after Saturday.

**The D-U-N-S number has been issued** — **352296291**, Dun & Bradstreet case
10859055 (tracking 10797660, request key BVD5Z3B3P9), resolved 2026-08-28 10:09
UTC and verified through the national registry. That was the gate on Apple
Developer Program **organization** enrolment — the difference between publishing
as DrippleX and publishing as an individual. The full set of values to hand
Apple is in `docs/store/APP-STORE.md`.

### Check before applying to Apple — closed

Apple verifies the applicant's legal entity name against the D&B record, and a
mismatch is the most common cause of a stalled enrolment. **It matches.** The
D-U-N-S was issued to **AFNAN HOMES LTD**, which is the entity
`docs/legal/DPX-LEGAL-001-TERMS-OF-USE.md` §1 names — DrippleX is its trading
name (RC 9387949). Apply as Afnan Homes Ltd; DrippleX is the app name, not the
applicant.

**Not before 2026-09-02.** D&B says the record is visible 2–3 business working
days after resolution, and the 28th was a Friday. Applying against a record that
has not propagated returns nothing and stalls the enrolment rather than queuing
it.

### Blockers that the DUNS does not remove

| Blocker                                | Note                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No macOS**                           | `xcodebuild archive` cannot run on Linux. CI validates the iOS scaffold only (the "iOS project preflight" job). Reaching a `.ipa` needs Mac hardware, MacStadium or Xcode Cloud — a purchase decision, not a code change.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ~~App icons~~                          | **Not a blocker — this row was wrong when written.** The iOS asset catalog holds the real DrippleX mark at 1024×1024 RGB, and `verify-icons.mjs` passes all 32 native brand assets. Founder decision 2026-08-29: ship the current mark (D + speed lines, no X). The X lives on the driver bubble; the icon is modernised once the business is stable.                                                                                                                                                                                                                                                                                                                                                                                       |
| ~~`aps-environment` is `development`~~ | **Fixed 2026-09-11, and it was worse than this row said.** `App.entitlements` was never wired into the build: no `CODE_SIGN_ENTITLEMENTS` in either configuration, and no `.xcconfig` setting one. The file existed, read correctly, and was applied to nothing — so push and Universal Links would both have been absent from any build, and flipping the one value would have changed nothing. Both configurations now reference an entitlements file: Release uses `App.entitlements` (`production`, required by the App Store and by TestFlight), Debug uses the new `AppDebug.entitlements` (`development`), because a debug build signed against a development profile while declaring `production` fails on an entitlement mismatch. |
| **Signing team unset**                 | `CODE_SIGN_STYLE = Automatic`; the team is configured in Xcode, which needs the enrolled account.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

Nothing here blocks Android, which is what the launch runs on.

## Audit findings left unchanged — settle these on the Mac

Found 2026-09-11 by reading the project on Linux. Each is a real observation; none
is changed here, because none can be _verified_ without Xcode, and guessing at
signing configuration is how you get a build that fails differently.

| Finding                                                                                                                                        | Where                                           | Why it is left alone                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CODE_SIGN_IDENTITY = "iPhone Developer"` is set at **project** level for **both** Debug and Release, and the App target does not override it. | `project.pbxproj:267` (Debug), `:324` (Release) | `"iPhone Developer"` is the legacy name for _Apple Development_ — a development identity, on the configuration used to archive. With `CODE_SIGN_STYLE = Automatic`, Xcode's distribution flow usually re-signs at export and this never surfaces; it is also the stock Capacitor template value, which is why thousands of apps ship with it. Whether it bites depends on the export path chosen on the Mac. Check it at the first archive; do not pre-emptively hardcode `Apple Distribution`. |
| `UIRequiredDeviceCapabilities` declares `armv7`.                                                                                               | `Info.plist`                                    | 32-bit ARM; no device that runs iOS 15 supports it. It is the stock Capacitor/Cordova value and shipping apps carry it, so it appears to be tolerated rather than validated. `arm64` would be the accurate declaration. Low confidence either way — flag at the first upload, when App Store Connect's validator gives a real answer.                                                                                                                                                           |
| **No `Podfile.lock` is committed.**                                                                                                            | `ios/App/`                                      | Every `pod install` re-resolves. All Capacitor pods are local `:path` references pinned by the pnpm lockfile, so the blast radius is small today — but it means the Mac build is not byte-reproducible against CI. Commit the lock once a Mac has generated a real one.                                                                                                                                                                                                                         |
| The Podfile hardcodes pnpm content-addressed paths (`node_modules/.pnpm/@capacitor+ios@7.6.8_@capacitor+core@7.6.8/...`).                      | `ios/App/Podfile`                               | Correct today and regenerated by `cap sync`. It will silently go stale against a hand-edited Podfile after any Capacitor version bump. Prefer re-running `cap sync ios` over editing it.                                                                                                                                                                                                                                                                                                        |
| The AASA template names `"appID": "TEAMID.com.dripplex.customer"`.                                                                             | `resources/deep-linking/README.md:69`           | `TEAMID` is a genuine placeholder — the real Team ID does not exist until enrolment completes. Universal Links stay dead until the file hosted at `app.dripplex.com/.well-known/apple-app-site-association` carries the real value. This is a dependency, not an omission.                                                                                                                                                                                                                      |

**On the bundle identifier.** iOS is `com.dripplex.customer`; Capacitor's
`appId` is `com.dripplex.app` because Play forced the Android rename. The
divergence is deliberate and recorded in `docs/store/APP-STORE.md`. `cap sync`
does not rewrite `PRODUCT_BUNDLE_IDENTIFIER`, so it is stable — but regenerating
the platform with `cap add ios` **would** overwrite it to `com.dripplex.app`.
Do not regenerate the iOS platform.

## App Store Connect

See `docs/store/APP-STORE.md` for metadata, screenshots, privacy labels, review notes.

## Build note (CI) — what the macOS job does and does not prove

`mobile-store-readiness.yml` has a real macOS job (`iOS simulator release build`).
It runs `cap sync ios` then:

```
xcodebuild -workspace App.xcworkspace -scheme App -configuration Release \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
```

**It proves:** the `.pbxproj` parses, the Pods resolve, and the Swift compiles
in the Release configuration.

**It does not prove the signing path.** `CODE_SIGNING_ALLOWED=NO` plus the
simulator SDK means entitlements are never applied and no identity is ever
selected. So the `CODE_SIGN_ENTITLEMENTS` wiring, `aps-environment`, the
associated domain, and `CODE_SIGN_IDENTITY` are all **unvalidated by CI** and
stay unvalidated until a signed device or archive build runs on a Mac. A green
tick on this job is not evidence that push or Universal Links work.

Full archive (`xcodebuild archive`) requires **macOS** with CocoaPods. Reaching a
`.ipa` needs Mac hardware, MacStadium or Xcode Cloud.
