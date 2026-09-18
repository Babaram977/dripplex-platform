# iOS packaging — Dripplex Customer

| Field                 | Value                   |
| --------------------- | ----------------------- |
| **Bundle ID**         | `com.dripplex.customer` |
| **Display name**      | DrippleX                |
| **Marketing version** | `1.0.0`                 |
| **Build**             | `1000100`               |
| **Min iOS**           | 15.0                    |

## First archive — 2026-09-17

**DrippleX 1.0.0 (1000100) is on App Store Connect.** Built with Xcode 26.6 on a
MacinCloud host, archived for `arm64`, passed Apple's validation with no
findings, uploaded. The app also runs on the iPhone 17 Pro simulator and renders
`app.dripplex.com` — proven remote rather than the bundled placeholder, because
`www/index.html` is a grey "Connecting…" card and what rendered was the real
landing page.

Three things cost hours. They are written down so the next session does not pay
for them again.

**1. Xcode had no iOS platform installed.** The first-run component picker was
still sitting there with _iOS 26.5 — 8.52 GB_ un-downloaded. Without the SDK
there are no simulators and nothing to compile against, so the build failed with
`Unable to resolve module dependency: 'Capacitor'` and seven warnings about
DerivedData search paths that nothing had created. CocoaPods was fine the whole
time — `pod install` does not need the SDK, the compiler does. Check with
`xcodebuild -showsdks` before diagnosing anything else; install with
`xcodebuild -downloadPlatform iOS`.

**2. `App/App/public` is gitignored but required.** It is a folder reference in
Copy Bundle Resources (`project.pbxproj:161`) and `ios/.gitignore:4` excludes it,
so a fresh clone never has it and recent Xcode treats the missing build input as
a hard error. `npx cap sync ios` creates it from the committed `www/index.html`.

**3. THE ARCHIVE BLOCKER: automatic signing needs a registered device.** With
`CODE_SIGN_STYLE = Automatic`, Xcode wants an _iOS App Development_ provisioning
profile to build the archive, and a development profile requires at least one
device registered to the team. A cloud Mac has none and an iPhone cannot be
attached over RDP, so `Product ▸ Archive` failed in about one second with
"Communication with Apple failed — your team has no devices" and "No profiles for
'com.dripplex.customer' were found".

**The fix is an App Store distribution profile, which has no device list at all:**

1. Xcode ▸ Settings ▸ Accounts ▸ AFNAN HOMES LTD ▸ Manage Certificates ▸ + ▸
   **Apple Distribution** (Xcode generates the CSR itself).
2. developer.apple.com ▸ Profiles ▸ + ▸ Distribution ▸ **App Store Connect**, for
   `com.dripplex.customer`, using that certificate. Download and install.
3. Target App ▸ Signing & Capabilities ▸ **Release** ▸ untick "Automatically
   manage signing" ▸ select that profile.
4. Product ▸ Archive.

**Two dead ends, recorded so they are not retried.** Setting
`CODE_SIGN_IDENTITY = "Apple Distribution"` by hand while automatic signing is on
produces "App has conflicting provisioning settings" — Xcode refuses a manual
identity in automatic mode. And `xcodebuild -allowProvisioningUpdates` does not
rescue a command-line archive here: it reports `error: No Accounts`, because
provisioning updates from the CLI need an App Store Connect API key, not the
GUI's signed-in account.

**Do not let Xcode "Manage Version and Build Number" during distribution.**
`apps/customer-mobile/scripts/verify-config.mjs` asserts the literals
`MARKETING_VERSION = 1.0.0` and `CURRENT_PROJECT_VERSION = 1000100`, so an
auto-increment silently rewrites the project and turns CI red.

### Still open after the first upload

- **An APNs key.** The push entitlement validated, but no key exists yet, so push
  is not proven end to end.
- **Universal Links at runtime.** Entitlement and hosted AASA are both correct;
  the actual "tap a link, app opens" test needs the build on a real device via
  TestFlight.
- **EU trader status.** App Store Connect shows a Digital Services Act banner
  that blocks EU _submission_. It does not block TestFlight, and it needs an
  Admin or Account Holder.
- **Category.** Xcode wrote
  `INFOPLIST_KEY_LSApplicationCategoryType = "public.app-category.travel"`, which
  matches Google Play's Travel & Local. `docs/store/APP-STORE.md` still lists the
  iOS primary category as Shopping, pending founder confirmation.

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
read; **Proven** means something executed it. The single ✅ column this table used
to carry is what let "entitlements exist" be recorded as "push works".

**Updated 2026-09-17 — a Mac has now built this project.** The signing path is no
longer unproven: the app compiled, archived, passed Apple's validation and was
uploaded to App Store Connect as 1.0.0 (1000100). See "First archive" below.
Rows still marked ⬜ are the ones that genuinely need a device or a key, not the
ones that were merely waiting for a Mac.

| Item                   | Present                                              | Proven                                                               |
| ---------------------- | ---------------------------------------------------- | -------------------------------------------------------------------- |
| Bundle identifier      | ✅ `com.dripplex.customer`                           | ✅ CI Release compile                                                |
| Launch screen          | ✅ `LaunchScreen.storyboard`                         | ✅ CI Release compile                                                |
| App icons              | ✅ 1024×1024, RGB, **no alpha** — re-read 2026-09-11 | ✅ `verify-icons.mjs`                                                |
| Privacy Manifest       | ✅ `PrivacyInfo.xcprivacy`                           | ✅ Apple validation, 2026-09-17                                      |
| App Transport Security | ✅ HTTPS only (localhost exception)                  | ✅ CI Release compile                                                |
| Non-exempt encryption  | ✅ `ITSAppUsesNonExemptEncryption = false`           | ✅ Apple validation, 2026-09-17 — no export-compliance prompt        |
| Custom URL scheme      | ✅ `dripplex://`                                     | ⬜ needs a device                                                    |
| Deployment target      | ✅ 15.0 — Xcode 26 floor                             | ✅ archived with Xcode 26.6 / iOS 26.5 SDK, 2026-09-17               |
| **Universal Links**    | ✅ entitlement wired 2026-09-11                      | ⬜ **needs a device** — signed build ✅, hosted AASA ✅ (see below)  |
| **Push (APNs)**        | ✅ `UIBackgroundModes` + entitlement (`production`)  | ⬜ **needs an APNs key** — signed build ✅, entitlement validated ✅ |

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
| ~~**No macOS**~~                       | **Removed 2026-09-17.** A MacinCloud/RDP Mac running Xcode 26.6 archived, validated and uploaded the app. CI still validates the iOS scaffold only (the "iOS project preflight" job runs on `ubuntu-latest` and greps files — it has never compiled iOS), so the Mac remains the only place a real build happens.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ~~App icons~~                          | **Not a blocker — this row was wrong when written.** The iOS asset catalog holds the real DrippleX mark at 1024×1024 RGB, and `verify-icons.mjs` passes all 32 native brand assets. Founder decision 2026-08-29: ship the current mark (D + speed lines, no X). The X lives on the driver bubble; the icon is modernised once the business is stable.                                                                                                                                                                                                                                                                                                                                                                                       |
| ~~`aps-environment` is `development`~~ | **Fixed 2026-09-11, and it was worse than this row said.** `App.entitlements` was never wired into the build: no `CODE_SIGN_ENTITLEMENTS` in either configuration, and no `.xcconfig` setting one. The file existed, read correctly, and was applied to nothing — so push and Universal Links would both have been absent from any build, and flipping the one value would have changed nothing. Both configurations now reference an entitlements file: Release uses `App.entitlements` (`production`, required by the App Store and by TestFlight), Debug uses the new `AppDebug.entitlements` (`development`), because a debug build signed against a development profile while declaring `production` fails on an entitlement mismatch. |
| ~~**Signing team unset**~~             | **Set 2026-09-17.** `DEVELOPMENT_TEAM = X9MCF93WB7` (AFNAN HOMES LTD) on both configurations, `CODE_SIGN_STYLE = Automatic`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

Nothing here blocks Android, which is what the launch runs on.

## Universal Links are dead at the hosting layer — proven 2026-09-12

Separate from entitlements, and not fixed by them. Apple fetches
`https://app.dripplex.com/.well-known/apple-app-site-association` to authorise
the associated domain. Today:

```
$ curl -sSI https://app.dripplex.com/.well-known/apple-app-site-association
HTTP 200 | content-type: text/html; charset=utf-8 | 3120 bytes   <- the SPA
$ curl -sS  https://app.dripplex.com/.well-known/assetlinks.json
HTTP 200 | application/json                                       <- Android works
```

**There is no AASA file anywhere in the repository.** Android's `assetlinks.json`
lives at `apps/super-app/public/.well-known/` and is served correctly, so the
mechanism looks like it exists. It does not, for Apple.

### The obvious fix does not work, and looks like it does

Dropping the file next to `assetlinks.json` is the natural move. It fails.
Measured against `serve@14` — the exact server the super-app runs in production
(`serve -s dist --config serve.json`, see `apps/super-app/Dockerfile`) — with
the file physically present in `dist/.well-known/`:

| Server invocation                                                  | Result for the AASA path    |
| ------------------------------------------------------------------ | --------------------------- |
| `serve -s dist --config serve.json` (production)                   | 200 `text/html` — SPA index |
| `serve dist --config serve.json` (no `-s`)                         | 200 `text/html` — SPA index |
| `serve -s dist` (no config)                                        | 200 `text/html` — SPA index |
| `serve dist` (no flags, no config)                                 | 200 `text/html` — SPA index |
| plus `cleanUrls: false` and an explicit `Content-Type` header rule | 200 `text/html` — SPA index |

`assetlinks.json` returned `200 application/json` throughout, and deep SPA routes
kept working. **The variable is the missing file extension**, which Apple
mandates: the path must be exactly `apple-app-site-association`, no `.json`.

So the file would have been committed, deployed, and returned HTTP 200 to every
check — while Apple silently rejected it. That is the third instance of this
shape in this app: the orphan entitlements file, `GEOCODER` at `undefined`, and
now this. A 200 is not a pass.

**Redirecting is not a workaround** — Apple does not follow redirects for this
file — and renaming it to `.json` is not permitted.

### What it needs — a hosting decision, not a code tweak

`app.dripplex.com` answers `server: railway-hikari`: it is served straight from
the Railway container, with no Cloudflare Worker in front to intercept the path.
The fix therefore has to change how a **live production service** serves static
files, which is why nothing is changed here:

| Option                                                                                                         | Blast radius                                                                         |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **A — small Node shim in front of `serve`** that answers this one path with `application/json`, then delegates | Smallest; testable locally exactly as the table above was produced. **Recommended.** |
| B — replace `serve` with nginx in the runner stage                                                             | Swaps the web server for a live app                                                  |
| C — front `app.dripplex.com` with a Cloudflare Worker                                                          | Changes routing for the live app                                                     |

**No longer blocked. Resolved 2026-09-17:** the Apple Team ID is **`X9MCF93WB7`**
(AFNAN HOMES LTD), confirmed from the account itself — Xcode wrote
`DEVELOPMENT_TEAM = X9MCF93WB7` into both configurations of `project.pbxproj`
when the team was selected. The hosted AASA already carried that exact value, so
it needed no change and **must not be changed**. The Team ID is not a secret — it
is published in the AASA of every app using Universal Links — unlike the Apple
account password, 2FA codes, or an App Store Connect API key.

## Audit findings left unchanged — settle these on the Mac

Found 2026-09-11 by reading the project on Linux. Each is a real observation; none
is changed here, because none can be _verified_ without Xcode, and guessing at
signing configuration is how you get a build that fails differently.

| Finding                                                                                                                   | Where                                           | Why it is left alone                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ~~`CODE_SIGN_IDENTITY = "iPhone Developer"` is set at **project** level for **both** Debug and Release.~~                 | `project.pbxproj:267` (Debug), `:324` (Release) | **Answered 2026-09-17 at the first archive: this was never the problem, and it was not changed.** Under `CODE_SIGN_STYLE = Automatic` an archive is _meant_ to build with a development identity and be re-signed with the distribution certificate at export, so the legacy name is harmless. Setting it to `Apple Distribution` by hand actively breaks the build — Xcode refuses a manually specified identity while automatic signing is on, and fails with "App has conflicting provisioning settings". Leave this alone. |
| `UIRequiredDeviceCapabilities` declares `armv7`.                                                                          | `Info.plist`                                    | 32-bit ARM; no device that runs iOS 15 supports it. It is the stock Capacitor/Cordova value and shipping apps carry it, so it appears to be tolerated rather than validated. `arm64` would be the accurate declaration. Low confidence either way — flag at the first upload, when App Store Connect's validator gives a real answer.                                                                                                                                                                                          |
| **No `Podfile.lock` is committed.**                                                                                       | `ios/App/`                                      | **A Mac generated a real one on 2026-09-17.** Per this row's own instruction, commit it — it is untracked, not ignored, and without it every `pod install` re-resolves and the Mac build is not reproducible against CI.                                                                                                                                                                                                                                                                                                       |
| The Podfile hardcodes pnpm content-addressed paths (`node_modules/.pnpm/@capacitor+ios@7.6.8_@capacitor+core@7.6.8/...`). | `ios/App/Podfile`                               | Correct today and regenerated by `cap sync`. It will silently go stale against a hand-edited Podfile after any Capacitor version bump. Prefer re-running `cap sync ios` over editing it.                                                                                                                                                                                                                                                                                                                                       |
| ~~The AASA template names `"appID": "TEAMID.com.dripplex.customer"`.~~                                                    | `resources/deep-linking/README.md`              | **This row was already stale when written here.** That README carries the real value, `X9MCF93WB7.com.dripplex.customer`, and says in as many words that it is no longer a template. The hosted file at `apps/super-app/public/.well-known/apple-app-site-association` carries the same. Nothing is placeholdered.                                                                                                                                                                                                             |

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
